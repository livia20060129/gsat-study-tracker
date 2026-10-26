import assert from 'node:assert/strict';
import test from 'node:test';
import { saveLocalRecordEdit } from '../src/application/records/localRecordEdits.ts';
import { decodeStudyRecord, encodeStudyRecord } from '../src/storage/studyRecordCodec.ts';
import { cambridgeDictionaryUrl, dictionaryQuery, dictionaryResult, type DictionaryLookupResult } from '../src/study/dictionaryEntries.ts';
import { applyDictionarySelection, dictionarySources } from '../src/study/dictionarySelection.ts';
import { localDictionaryLookup } from '../src/study/localDictionaryLookup.ts';
import { updateVocabularyWordEntries, vocabularyReviewEntries } from '../src/study/vocabularyReview.ts';
import { vocabularyPrintDocument } from '../src/study/vocabularyPrint.ts';
import type { EnglishReviewWordEntry, StudyRecord } from '../src/types.ts';
import { cambridgeApiResult } from '../supabase/functions/_shared/cambridgeEntries.ts';
import { createDictionaryLookupHandler } from '../supabase/functions/_shared/dictionaryLookup.ts';

const result: DictionaryLookupResult = { provider: 'cambridge', word: 'cell', sourceUrl: cambridgeDictionaryUrl('cell'),
  meanings: [{ partOfSpeech: 'noun', text: '測試意思甲' }, { partOfSpeech: 'verb', text: '測試意思乙' }] };

function entryHtml(): string {
  return '<div class="entry-body__el"><span class="pos dpos">noun</span><span class="trans dtrans">測試意思甲</span>'
    + '<div class="examp dexamp"><span class="trans dtrans">不該匯入的例句翻譯</span></div>'
    + '<div class="phrase-block"><span class="trans">不該匯入的其他片語</span></div></div>'
    + '<div class="entry-body__el"><span class="pos">verb</span><span class="trans">測試意思乙</span></div>';
}
function record(word: EnglishReviewWordEntry = { id: 'word', text: 'cell', noun: true, translation: '手動翻譯', gsatLevel: 4, showGsatLevel: false }): StudyRecord {
  return { date: '2026-10-26', notes: '保留筆記', items: [{ id: 'item', type: 'englishVocabInteractive', done: true,
    required: false, minutes: '25', checkedOn: '2026-10-26', f: { words: [word] } }] };
}

test('dictionary query accepts short Latin words and phrases but rejects URLs, markup and oversized input', () => {
  assert.equal(dictionaryQuery(' Cell '), 'cell');
  assert.equal(dictionaryQuery('Café'), 'café');
  assert.equal(dictionaryQuery('mother-in-law'), 'mother-in-law');
  assert.equal(dictionaryQuery('look  after'), 'look after');
  for (const value of ['', null, {}, 'https://example.com', '../cell', '<script>x</script>', 'cell?x=y', 'cell 中文', 'a'.repeat(81)]) {
    assert.equal(dictionaryQuery(value), null);
  }
});

test('remote dictionary contract rejects wrong headwords, unknown POS and untrusted source URLs', () => {
  assert.deepEqual(dictionaryResult(result, 'CELL'), result);
  assert.equal(dictionaryResult(result, 'other'), null);
  for (const sourceUrl of ['javascript:alert(1)', 'https://dictionary.cambridge.org.evil/dictionary/english-chinese-traditional/cell',
    'https://user@dictionary.cambridge.org/dictionary/english-chinese-traditional/cell', 'https://dictionary.cambridge.org/elsewhere']) {
    assert.equal(dictionaryResult({ ...result, sourceUrl }, 'cell'), null);
  }
  assert.equal(dictionaryResult({ ...result, meanings: [{ partOfSpeech: 'anything', text: '意思' }] }, 'cell'), null);
  assert.equal(dictionaryResult({ ...result, meanings: [{ partOfSpeech: 'noun', text: '<img src=x>' }] }, 'cell'), null);
});

test('licensed API HTML becomes separate plain POS meanings and excludes examples, phrases and scripts', () => {
  const payload = { entryLabel: 'cell', format: 'html', entryContent: entryHtml() + '<script><span class="trans">惡意腳本</span></script>' };
  assert.deepEqual(cambridgeApiResult(payload, 'cell'), result);
  const entities = cambridgeApiResult({ entryLabel: 'cell', entryContent: '<span class="pos">noun</span><span class="trans">&#x7d30;胞&nbsp;甲</span>' }, 'cell');
  assert.equal(entities?.meanings[0].text, '細胞 甲');
});

test('API parsing refuses a first-result spelling mismatch, English-only content and unsupported markup without inventing meanings', () => {
  assert.equal(cambridgeApiResult({ entryLabel: 'cells', entryContent: entryHtml() }, 'cell'), null);
  assert.equal(cambridgeApiResult({ entryLabel: 'cell', entryContent: '<span class="def">an English definition</span>' }, 'cell'), null);
  assert.equal(cambridgeApiResult({ entryLabel: 'cell', entryContent: '<span class="trans">English only</span>' }, 'cell'), null);
  const determiner = cambridgeApiResult({ entryLabel: 'cell', entryContent: '<span class="pos">determiner</span><span class="trans">測試意思</span>' }, 'cell');
  assert.equal(determiner?.meanings[0].partOfSpeech, 'unclassified');
});

test('confirming selected senses appends to manual data and never changes English text, levels, disabled Level visibility or time', () => {
  const word: EnglishReviewWordEntry = { text: 'Cell', noun: true, translation: '原有意思',
    gsatLevel: 4, showGsatLevel: false, arbitrary: '保留' };
  assert.equal(applyDictionarySelection(word, { ...result, meanings: [result.meanings[0]] }), true);
  assert.deepEqual(word.translationsByPartOfSpeech?.noun, ['原有意思', '測試意思甲']);
  assert.equal(word.verb, undefined);
  assert.equal(word.text, 'Cell');
  assert.equal(word.gsatLevel, 4);
  assert.equal(word.showGsatLevel, false);
  assert.equal(word.arbitrary, '保留');
  const once = structuredClone(word);
  assert.equal(applyDictionarySelection(word, { ...result, meanings: [result.meanings[0]] }), false);
  assert.deepEqual(word, once);
});

test('local preview uses the shipped dictionary, requires no fetch and confirmation ignores combinations and sentences', () => {
  const local = localDictionaryLookup('cell');
  assert.equal(local?.provider, 'ecdict');
  assert.ok(local?.meanings.length);
  assert.equal(localDictionaryLookup('zzzzunlistedwordzzzz'), null);
  for (const kind of ['fixedCombination', 'beautifulSentences']) {
    const word = { text: 'cell', [kind]: true };
    assert.equal(applyDictionarySelection(word, result), false);
    assert.deepEqual(word, { text: 'cell', [kind]: true });
  }
});

test('reconfirming an existing source does not evict another attribution from a full source list', () => {
  const sources = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta'].map(word => ({
    provider: 'cambridge' as const, word, sourceUrl: cambridgeDictionaryUrl(word),
  }));
  assert.deepEqual(dictionarySources([...sources, sources[3]]), sources);
});

test('dictionary selection updates matching word occurrences only and survives JSON/local/cloud codec round-trips with source attribution', () => {
  const original = record();
  original.items[0].f.words!.push({ id: 'other', text: 'other', translation: '不要改' });
  original.items.push({ ...original.items[0], id: 'duplicate', minutes: '10', f: { words: [{ text: 'cell', translation: '另一筆手動內容', noun: true }] } });
  assert.equal(updateVocabularyWordEntries(original, 'cell', { dictionarySelection: result }), true);
  const decoded = decodeStudyRecord(encodeStudyRecord(JSON.parse(JSON.stringify(original))));
  assert.equal(decoded.ok, true);
  if (!decoded.ok) throw new Error('Expected valid record');
  assert.equal(decoded.record.notes, '保留筆記');
  assert.equal(decoded.record.items[0].minutes, '25');
  assert.equal(decoded.record.items[0].done, true);
  const words = decoded.record.items[0].f.words as EnglishReviewWordEntry[];
  assert.equal(words[1].translation, '不要改');
  assert.deepEqual(words[0].dictionarySources, [{ provider: 'cambridge', word: 'cell', sourceUrl: result.sourceUrl }]);
  const entries = vocabularyReviewEntries([decoded.record]);
  assert.equal(entries.find(entry => entry.key === 'cell')?.dictionarySources?.[0].provider, 'cambridge');
  assert.ok((decoded.record.items[1].f.words as EnglishReviewWordEntry[])[0].translationsByPartOfSpeech?.noun?.includes('另一筆手動內容'));
});

test('dictionary confirmation merges newer unrelated edits instead of replacing notes or completion in another tab', () => {
  const base = record();
  const latest = structuredClone(base);
  latest.notes = '另一個分頁的最新筆記';
  latest.items[0].minutes = '40';
  const values = new Map([[`p:${base.date}`, JSON.stringify(latest)]]);
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const saved = saveLocalRecordEdit(storage, 'p:', base, function confirm(record): StudyRecord {
    const copy = structuredClone(record);
    updateVocabularyWordEntries(copy, 'cell', { dictionarySelection: result });
    return copy;
  });
  assert.equal(saved?.notes, latest.notes);
  assert.equal(saved?.items[0].minutes, '40');
  assert.equal(saved?.localDirty, true);
});

test('translated PDF attribution follows selected sources and the blank export never embeds the Chinese answers', () => {
  const value = record();
  updateVocabularyWordEntries(value, 'cell', { dictionarySelection: result });
  const entries = vocabularyReviewEntries([value]);
  assert.match(vocabularyPrintDocument(entries, '單字', true), /Cambridge Dictionary/);
  assert.doesNotMatch(vocabularyPrintDocument(entries, '單字', false), /測試意思甲|測試意思乙|Cambridge Dictionary/);
  const local = localDictionaryLookup('cell')!;
  updateVocabularyWordEntries(value, 'cell', { dictionarySelection: local });
  assert.match(vocabularyPrintDocument(vocabularyReviewEntries([value]), '單字', true), /MIT License/);
});

const userId = '00000000-0000-0000-0000-000000000001';
function response(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}
function request(word = 'cell', extra: Record<string, string> = {}): Request {
  return new Request('https://project.supabase.co/functions/v1/dictionary-lookup', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid.user.signature', Origin: 'https://myself.liviayeh.dev', ...extra },
    body: JSON.stringify({ word }) });
}
function service(fetcher: typeof fetch, extra = {}) {
  return createDictionaryLookupHandler({ supabaseUrl: 'https://project.supabase.co', publishableKey: 'public-test-key',
    apiKey: 'private-test-api-key', dictionaryCode: 'test-traditional', fetch: fetcher, ...extra });
}

test('backend requires authentication, sends only the requested word to the fixed API and never forwards user credentials or secrets to the response', async () => {
  const calls: Array<{ url: string; headers: Headers }> = [];
  const handler = service(async (input, init) => {
    const url = String(input);
    calls.push({ url, headers: new Headers(init?.headers) });
    if (url.endsWith('/auth/v1/user')) return response({ id: userId });
    return response({ entryLabel: 'cell', entryContent: entryHtml() });
  });
  const output = await handler(request());
  assert.equal(output.status, 200);
  assert.equal(output.headers.get('Cache-Control'), 'no-store');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].headers.get('Authorization'), 'Bearer valid.user.signature');
  assert.equal(calls[1].headers.get('Authorization'), null);
  assert.equal(calls[1].headers.get('accessKey'), 'private-test-api-key');
  assert.equal(new URL(calls[1].url).hostname, 'dictionary.cambridge.org');
  assert.equal(new URL(calls[1].url).searchParams.get('q'), 'cell');
  const text = await output.text();
  assert.doesNotMatch(text, /private-test-api-key|valid\.user\.signature|entryContent|保留筆記/);
  assert.deepEqual(JSON.parse(text).result, result);
});

test('backend rejects unsupported methods, origins, malformed and oversized inputs before upstream requests', async () => {
  let calls = 0;
  const handler = service(async () => { calls++; return response({}); });
  assert.equal((await handler(new Request('https://project/functions'))).status, 405);
  assert.equal((await handler(new Request('https://project/functions', { method: 'OPTIONS', headers: { Origin: 'http://127.0.0.1:4173' } }))).status, 204);
  assert.equal((await handler(request('cell', { Origin: 'https://evil.example' }))).status, 403);
  assert.equal((await handler(request('https://evil.example'))).status, 400);
  assert.equal((await handler(request('a'.repeat(3000)))).status, 400);
  assert.equal((await handler(request('cell', { 'Content-Type': 'text/plain' }))).status, 415);
  assert.equal(calls, 0);
});

test('missing, expired and anonymous user sessions cannot query Cambridge', async () => {
  let upstream = 0;
  for (const auth of [response({}, 401), response({ id: userId, is_anonymous: true })]) {
    const handler = service(async input => {
      if (String(input).endsWith('/auth/v1/user')) return auth;
      upstream++;
      return response({});
    });
    assert.equal((await handler(request())).status, 401);
    assert.equal((await handler(request('cell', { Authorization: 'Bearer sb_publishable_example' }))).status, 401);
  }
  assert.equal(upstream, 0);
});

test('an unconfigured licensed API reports a recoverable status without fetching any dictionary content', async () => {
  let calls = 0;
  const handler = service(async () => { calls++; return response({ id: userId }); }, { apiKey: '' });
  const output = await handler(request());
  assert.equal(output.status, 503);
  assert.equal((await output.json()).code, 'not_configured');
  assert.equal(calls, 1);
});

test('backend limits each user to six lookups per minute and performs no whole-dictionary downloads or retries', async () => {
  let time = 0;
  let dictionaryCalls = 0;
  const handler = service(async input => {
    if (String(input).endsWith('/auth/v1/user')) return response({ id: userId });
    dictionaryCalls++;
    return response({ entryLabel: 'cell', entryContent: entryHtml() });
  }, { now: () => time });
  for (let i = 0; i < 6; i++) assert.equal((await handler(request())).status, 200);
  const limited = await handler(request());
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('Retry-After'), '60');
  assert.equal(dictionaryCalls, 6);
  time = 60_001;
  assert.equal((await handler(request())).status, 200);
  assert.equal(dictionaryCalls, 7);
});

test('blocked, malformed and mismatched API responses never become saved meanings and do not leak upstream error bodies', async () => {
  for (const [upstream, expected] of [
    [response({ error: 'private-test-api-key' }, 403), 502], [response({}, 429), 429],
    [new Response('<html>blocked</html>', { headers: { 'Content-Type': 'text/html' } }), 502],
    [response({ entryLabel: 'cells', entryContent: entryHtml() }), 404],
    [response({ entryLabel: 'cell', entryContent: 'x'.repeat(1_000_001) }), 502],
  ] as const) {
    const handler = service(async input => String(input).endsWith('/auth/v1/user') ? response({ id: userId }) : upstream);
    const output = await handler(request());
    assert.equal(output.status, expected);
    assert.doesNotMatch(await output.text(), /private-test-api-key|<html>|測試意思/);
  }
});

test('a slow upstream lookup is aborted and returns a recoverable failure', async () => {
  let aborted = false;
  const handler = service(async (input, init) => {
    if (String(input).endsWith('/auth/v1/user')) return response({ id: userId });
    return new Promise<Response>((_, reject) => init!.signal!.addEventListener('abort', () => {
      aborted = true;
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true }));
  }, { timeoutMs: 10 });
  const output = await handler(request());
  assert.equal(output.status, 502);
  assert.equal(aborted, true);
});
