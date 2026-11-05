import assert from 'node:assert/strict';
import test from 'node:test';
import { createGoogleTranslationHandler } from '../supabase/functions/_shared/googleTranslation.ts';
import { createVocabularyDefaultsLoader } from '../src/study/vocabularyDefaults.ts';
import { applyVocabularyAutoFill, markVocabularyManualFields, vocabularyAutoFillSources } from '../src/study/vocabularyAutoFill.ts';
import { vocabularyReviewEntries } from '../src/study/vocabularyReview.ts';
import { vocabularyExportNotices } from '../src/study/vocabularyExportContent.ts';
import type { EnglishReviewWordEntry } from '../src/types.ts';

const userId = '00000000-0000-0000-0000-000000000001';
function setup(overrides: Record<string, string> = {}, user = userId, anonymous = false) {
  const env = { GOOGLE_TRANSLATION_API_KEY: 'server-only-key', SUPABASE_SERVICE_ROLE_KEY: 'server-role-key',
    SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'publishable', ...overrides };
  const calls: { url: string; options?: RequestInit }[] = [];
  const balances = new Map<string, number>();
  const receipts = new Map<string, { user: string; words: number }>();
  const failures = { auth: false, quota: false, loseQuotaReply: false, google: false, malformedQuota: false };
  let time = 1000;
  const fetchMock: typeof fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/auth/v1/user')) return Response.json({ id: user, is_anonymous: anonymous }, { status: failures.auth ? 401 : 200 });
    if (String(url).endsWith('/rpc/google_translation_quota')) {
      if (failures.quota) return new Response('private database message', { status: 503 });
      const body = JSON.parse(String(options?.body)), used = balances.get(body.p_user_id) ?? 0;
      const repeated = receipts.has(body.p_request_id);
      const allowed = repeated || used + body.p_words <= 5000;
      if (allowed && !repeated) {
        balances.set(body.p_user_id, used + body.p_words);
        receipts.set(body.p_request_id, { user: body.p_user_id, words: body.p_words });
      }
      if (failures.loseQuotaReply) { failures.loseQuotaReply = false; throw new Error('connection lost'); }
      const after = balances.get(body.p_user_id) ?? 0;
      return Response.json({ allowed, unit: failures.malformedQuota ? 'characters' : 'words', month: '2026-11',
        used: after, limit: 5000, remaining: 5000 - after, resetsAt: '2026-11-30T16:00:00Z' });
    }
    if (failures.google) return new Response('private upstream server-only-key', { status: 403 });
    return Response.json({ data: { translations: [{ translatedText: '範例中文' }] } });
  };
  function restart() {
    return createGoogleTranslationHandler({ env: name => env[name as keyof typeof env], now: () => time, fetch: fetchMock });
  }
  const handler = restart();
  function request(word = 'unlistedword', target = handler): Promise<Response> {
    return target(new Request('https://example/functions/v1/google-translation', {
      method: 'POST', headers: { authorization: 'Bearer session' }, body: JSON.stringify({ word }),
    }));
  }
  return { handler, request, calls, balances, failures, restart, advance() { time += 60_000; } };
}

test('all registered users can translate with server credentials and an authoritative word allowance', async () => {
  const { request, calls } = setup();
  const response = await request('extraordinary');
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.provider, 'google');
  assert.equal(result.word, 'extraordinary');
  assert.equal(result.translation, '範例中文');
  assert.equal(result.quota.used, 1);
  assert.equal(result.quota.unit, 'words');
  assert.equal(calls.length, 3);
  assert.equal(JSON.parse(String(calls[1].options?.body)).p_words, 1);
  assert.deepEqual(JSON.parse(String(calls[2].options?.body)), { q: 'extraordinary', source: 'en', target: 'zh-TW', format: 'text' });
  assert.equal(new Headers(calls[2].options?.headers).get('X-goog-api-key'), 'server-only-key');
  assert.equal(new Headers(calls[2].options?.headers).has('authorization'), false);
  assert.ok(!JSON.stringify(result).includes('server-only-key'));
  assert.equal((await setup({ GOOGLE_TRANSLATION_ALLOWED_USER_IDS: '' }, '00000000-0000-0000-0000-000000000002').request()).status, 200);
});

test('guests, anonymous Auth sessions, missing config and invalid requests never invoke Google', async () => {
  const guest = setup();
  assert.equal((await guest.handler(new Request('https://example', { method: 'POST', body: '{}' }))).status, 401);
  assert.equal(guest.calls.length, 0);
  const anonymous = setup({}, userId, true);
  assert.equal((await anonymous.request()).status, 401);
  assert.equal(anonymous.calls.length, 1);
  const revoked = setup(); revoked.failures.auth = true;
  assert.equal((await revoked.request()).status, 401);
  assert.equal(revoked.calls.length, 1);
  assert.equal((await setup({ GOOGLE_TRANSLATION_API_KEY: '' }).request()).status, 503);
  assert.equal((await setup({ SUPABASE_SERVICE_ROLE_KEY: '' }).request()).status, 503);
  const invalid = setup();
  for (const value of ['a sentence here', '<script>', 'word123', 'a'.repeat(81)]) assert.equal((await invalid.request(value)).status, 400);
  assert.equal((await invalid.request('a'.repeat(2000))).status, 413);
  assert.equal(invalid.calls.filter(call => call.url.includes('googleapis')).length, 0);
  assert.equal(invalid.calls.filter(call => call.url.includes('/rpc/')).length, 0);
});

test('the 5000th word succeeds, a new function instance cannot bypass exhaustion, and server cache stays free', async () => {
  const proxy = setup();
  proxy.balances.set(userId, 4999);
  const last = await (await proxy.request('extraordinary')).json();
  assert.equal(last.quota.used, 5000);
  const blocked = await proxy.request('differentword', proxy.restart());
  assert.equal(blocked.status, 429);
  const error = await blocked.json();
  assert.equal(error.code, 'translation_monthly_limit');
  assert.equal(error.quota.remaining, 0);
  assert.equal((await proxy.request('extraordinary')).status, 200);
  assert.equal(proxy.calls.filter(call => call.url.includes('googleapis')).length, 1);
  assert.equal(proxy.balances.get(userId), 5000);
});

test('a lost quota reply retries with one receipt and cannot debit the word twice', async () => {
  const proxy = setup(); proxy.failures.loseQuotaReply = true;
  assert.equal((await proxy.request()).status, 200);
  const debits = proxy.calls.filter(call => call.url.includes('/rpc/')).map(call => JSON.parse(String(call.options?.body)));
  assert.equal(debits.length, 2);
  assert.equal(debits[0].p_request_id, debits[1].p_request_id);
  assert.equal(proxy.balances.get(userId), 1);
  assert.equal(proxy.calls.filter(call => call.url.includes('googleapis')).length, 1);
});

test('database failures and a counter with the wrong unit fail closed without calling Google', async () => {
  for (const failure of ['quota', 'malformedQuota'] as const) {
    const proxy = setup(); proxy.failures[failure] = true;
    const response = await proxy.request();
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'translation_quota_unavailable');
    assert.equal(proxy.calls.filter(call => call.url.includes('googleapis')).length, 0);
  }
});

test('quota ownership comes from verified Auth rather than client-supplied account or month', async () => {
  const proxy = setup();
  const response = await proxy.handler(new Request('https://example', { method: 'POST', headers: { authorization: 'Bearer token' },
    body: JSON.stringify({ word: 'extraordinary', userId: 'another', month: '2030-01', words: 0 }) }));
  assert.equal(response.status, 200);
  const debit = JSON.parse(String(proxy.calls.find(call => call.url.includes('/rpc/'))!.options?.body));
  assert.equal(debit.p_user_id, userId);
  assert.equal(debit.p_words, 1);
  assert.equal(Object.hasOwn(debit, 'month'), false);
});

test('per-isolate burst guard rejects excess requests, resets, and does not bill cached words again', async () => {
  const proxy = setup();
  for (let i = 0; i < 20; i++) assert.equal((await proxy.request(`word${String.fromCharCode(97 + i)}`)).status, 200);
  assert.equal((await proxy.request('anotherword')).status, 429);
  assert.equal((await proxy.request('worda')).status, 200);
  proxy.advance();
  assert.equal((await proxy.request('anotherword')).status, 200);
  assert.equal(proxy.balances.get(userId), 21);
});

test('upstream failures keep the sent word charged and never disclose provider or database secrets', async () => {
  const proxy = setup(); proxy.failures.google = true;
  const response = await proxy.request();
  assert.equal(response.status, 502);
  assert.equal(proxy.balances.get(userId), 1);
  const body = await response.text();
  assert.ok(!body.includes('server-only-key') && !body.includes('server-role-key') && !body.includes('private upstream'));
  assert.equal(JSON.parse(body).quota.remaining, 4999);
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
