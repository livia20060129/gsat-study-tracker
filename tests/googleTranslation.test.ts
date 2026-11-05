import assert from 'node:assert/strict';
import test from 'node:test';
import { createGoogleTranslationHandler } from '../supabase/functions/_shared/googleTranslation.ts';
import { createVocabularyDefaultsLoader } from '../src/study/vocabularyDefaults.ts';
import { applyVocabularyAutoFill, markVocabularyManualFields, vocabularyAutoFillSources } from '../src/study/vocabularyAutoFill.ts';
import { vocabularyReviewEntries } from '../src/study/vocabularyReview.ts';
import { vocabularyExportNotices } from '../src/study/vocabularyExportContent.ts';
import type { EnglishReviewWordEntry } from '../src/types.ts';

function setup(overrides: Record<string, string> = {}, user = 'owner') {
  const env = { GOOGLE_TRANSLATION_API_KEY: 'server-only-key', GOOGLE_TRANSLATION_ALLOWED_USER_IDS: 'owner',
    SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'publishable', ...overrides };
  const calls: { url: string; options?: RequestInit }[] = [];
  let time = 1000;
  const handler = createGoogleTranslationHandler({ env: name => env[name as keyof typeof env], now: () => time,
    fetch: async (url, options) => {
      calls.push({ url: String(url), options });
      if (String(url).endsWith('/auth/v1/user')) return Response.json({ id: user });
      return Response.json({ data: { translations: [{ translatedText: '範例中文' }] } });
    } });
  function request(word = 'unlistedword'): Promise<Response> {
    return handler(new Request('https://example/functions/v1/google-translation', {
      method: 'POST', headers: { authorization: 'Bearer session' }, body: JSON.stringify({ word }),
    }));
  }
  return { handler, request, calls, advance() { time += 60_000; } };
}

test('translation proxy validates Auth then sends only one word to Google with server credentials', async () => {
  const { request, calls } = setup();
  const response = await request();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { provider: 'google', word: 'unlistedword', translation: '範例中文' });
  assert.equal(calls.length, 2);
  assert.deepEqual(JSON.parse(String(calls[1].options?.body)), { q: 'unlistedword', source: 'en', target: 'zh-TW', format: 'text' });
  assert.equal(calls[1].url, 'https://translation.googleapis.com/language/translate/v2');
  assert.equal(new Headers(calls[1].options?.headers).get('X-goog-api-key'), 'server-only-key');
  assert.ok(!JSON.stringify(await (await request()).json()).includes('server-only-key'));
  assert.equal(calls.filter(call => call.url.includes('googleapis')).length, 1);
});

test('guests, disallowed accounts, absent config and malformed/long requests cannot incur translation charges', async () => {
  const guest = setup();
  assert.equal((await guest.handler(new Request('https://example', { method: 'POST', body: '{}' }))).status, 401);
  assert.equal(guest.calls.length, 0);
  const other = setup({}, 'attacker');
  assert.equal((await other.request()).status, 403);
  assert.equal(other.calls.length, 1);
  const missing = setup({ GOOGLE_TRANSLATION_API_KEY: '' });
  assert.equal((await missing.request()).status, 503);
  const allowlist = setup({ GOOGLE_TRANSLATION_ALLOWED_USER_IDS: '' });
  assert.equal((await allowlist.request()).status, 503);
  const invalid = setup();
  for (const value of ['a sentence here', '<script>', 'word123', 'a'.repeat(81)]) assert.equal((await invalid.request(value)).status, 400);
  assert.equal((await invalid.request('a'.repeat(2000))).status, 413);
  assert.equal(invalid.calls.filter(call => call.url.includes('googleapis')).length, 0);
});

test('per-isolate burst guard rejects excess requests, resets, and does not bill cached words again', async () => {
  const proxy = setup();
  for (let i = 0; i < 20; i++) assert.equal((await proxy.request(`word${String.fromCharCode(97 + i)}`)).status, 200);
  assert.equal((await proxy.request('anotherword')).status, 429);
  assert.equal((await proxy.request('worda')).status, 200);
  proxy.advance();
  assert.equal((await proxy.request('anotherword')).status, 200);
});

test('upstream failures and revoked sessions return generic errors without credentials or raw responses', async () => {
  for (const authFailure of [false, true]) {
    const proxy = createGoogleTranslationHandler({ env: key => ({ SUPABASE_URL: 'https://example', SUPABASE_ANON_KEY: 'anon',
      GOOGLE_TRANSLATION_API_KEY: 'secret', GOOGLE_TRANSLATION_ALLOWED_USER_IDS: 'owner' })[key],
      fetch: async url => String(url).endsWith('/auth/v1/user')
        ? Response.json({ id: 'owner' }, { status: authFailure ? 401 : 200 })
        : new Response('private provider error secret', { status: 403 }) });
    const response = await proxy(new Request('https://example', { method: 'POST', headers: { authorization: 'Bearer token' }, body: '{"word":"word"}' }));
    assert.equal(response.status, authFailure ? 401 : 502);
    assert.ok(!(await response.text()).includes('secret'));
  }
});

test('ECDICT wins; only a confirmed miss uses Google, while failed downloads and phrases do not', async () => {
  let calls = 0;
  const translate = async () => { calls++; return '中文'; };
  assert.equal((await createVocabularyDefaultsLoader(async () => ({ noun: ['本機中文'] }), translate)('word'))?.source, 'ECDICT');
  assert.equal(calls, 0);
  assert.deepEqual(await createVocabularyDefaultsLoader(async () => null, translate)('unlistedword'),
    { translations: { unclassified: ['中文'] }, source: 'Google Translate' });
  assert.equal(calls, 1);
  assert.equal(await createVocabularyDefaultsLoader(async () => null, translate)('not a word'), null);
  await assert.rejects(createVocabularyDefaultsLoader(async () => { throw new Error('offline'); }, translate)('word'));
  assert.equal(calls, 1);
});

test('Google defaults never invent POS/Level, preserve manual edits and keep attribution through review/exports', () => {
  const word: EnglishReviewWordEntry = { text: 'unlistedword' };
  applyVocabularyAutoFill(word, { unclassified: ['中文'] }, 'Google Translate');
  assert.equal(word.noun, false);
  assert.equal(word.gsatLevel, undefined);
  assert.equal(word.vocabularyTranslationSource, 'Google Translate');
  assert.deepEqual(vocabularyAutoFillSources(word), { ceec: false, ecdict: false, google: true });
  const entries = vocabularyReviewEntries([{ date: '2026-11-05', items: [{ id: 'words', type: 'englishVocabInteractive',
    required: false, done: false, minutes: '', f: { words: [word] } }] }]);
  assert.equal(entries[0].referenceSources?.google, true);
  assert.ok(vocabularyExportNotices(entries, true).some(value => value.includes('Translated by Google')));
  assert.ok(!vocabularyExportNotices(entries, false).some(value => value.includes('Translated by Google')));
  word.translation = '手動中文';
  word.translationsByPartOfSpeech = { noun: ['手動中文'] };
  word.noun = true;
  markVocabularyManualFields(word, ['translation', 'translationsByPartOfSpeech', 'noun']);
  applyVocabularyAutoFill(word, { unclassified: ['另一翻譯'] }, 'Google Translate');
  assert.equal(word.translation, '手動中文');
  assert.equal(word.noun, true);
});
