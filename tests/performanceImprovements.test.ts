import assert from 'node:assert/strict';
import test from 'node:test';
import { coalescedRecordRefresh, isRecordStorageChange } from '../src/ui/recordRefresh.ts';
import { ProgressiveEntries } from '../src/ui/progressiveEntries.ts';
import { createOverdueTaskCache } from '../src/study/overdueTaskCache.ts';
import { overdueTasks } from '../src/study/overdueTasks.ts';
import { createCeecCoreLookup } from '../src/study/ceecCoreTranslations.ts';
import { CEEC_MEANING_ROWS } from '../src/data/ceecCompactTranslations.ts';
import { applyVocabularyAutoFill } from '../src/study/vocabularyAutoFill.ts';
import type { EnglishReviewWordEntry, StudyRecord } from '../src/types.ts';

test('record notifications exclude other accounts, metadata, preferences and other storage areas', () => {
  const storage = {} as Storage, other = {} as Storage, prefix = 'study-v11:user:a:';
  const changed = (key: string | null, storageArea: Storage | null = storage) => isRecordStorageChange({ key, storageArea }, prefix, storage);
  assert.equal(changed(prefix + '2026-11-04'), true);
  assert.equal(changed(null), true);
  assert.equal(changed('study-v11:meta:active-record-prefix'), true);
  for (const key of ['study-v11:user:b:2026-11-04', prefix + 'meta:pending-sync:2026-11-04', 'preference', prefix + '2026-11-04:backup']) assert.equal(changed(key), false);
  assert.equal(changed(prefix + '2026-11-04', other), false);
});

test('a burst refreshes once, account switching flushes immediately and cancellation removes delayed work', async () => {
  let calls = 0;
  const refresh = coalescedRecordRefresh(() => { calls++; }, 5);
  for (let i = 0; i < 20; i++) refresh.schedule();
  refresh.flush();
  assert.equal(calls, 1);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(calls, 1);
  refresh.schedule(); refresh.cancel();
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(calls, 1);
  refresh.schedule();
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(calls, 2);
});

test('presentation budgets append batches, retain edits and reset for another filter or account', () => {
  const list = new ProgressiveEntries(60);
  assert.equal(list.prepare('account-a:all', 1000), 60);
  assert.equal(list.hasMore, true);
  assert.equal(list.more(), true);
  assert.equal(list.prepare('account-a:all', 1001), 120);
  assert.equal(list.prepare('account-a:all', 1001, 201), 201);
  assert.equal(list.prepare('account-a:search', 1), 1);
  assert.equal(list.more(), false);
  assert.equal(list.prepare('account-b:all', 1000), 60);
  assert.equal(list.prepare('empty', 0), 0);
  assert.equal(list.hasMore, false);
});

test('overdue projections reuse immutable records but rebuild after an edit or midnight', () => {
  let calls = 0;
  const cache = createOverdueTaskCache((records, today) => { calls++; return overdueTasks(records, today); });
  const records: StudyRecord[] = [{ date: '2026-11-04', items: [{ id: 'task', type: 'scienceReview', source: 'preset',
    required: true, done: false, minutes: '25', f: { subject: '物理', material: '新關鍵', start: '1', end: '8' } }] }];
  const first = cache.get(records, '2026-11-05');
  assert.equal(first.length, 1);
  assert.equal(cache.get(records, '2026-11-05'), first);
  assert.equal(calls, 1);
  assert.equal(cache.get(records, '2026-11-06')[0].daysOverdue, 2);
  assert.equal(calls, 2);
  const updated = structuredClone(records); updated[0].items[0].done = true;
  assert.equal(cache.get(updated, '2026-11-06').length, 0);
  assert.equal(calls, 3);
  cache.invalidate(); cache.get(updated, '2026-11-06');
  assert.equal(calls, 4);
});

test('dictionary text loads only on demand, shares the pending request and keeps detached exact meanings', async () => {
  let calls = 0, release!: (rows: { CEEC_MEANING_ROWS: string }) => void;
  const core = createCeecCoreLookup(() => { calls++; return new Promise(resolve => { release = resolve; }); });
  assert.equal(core.find('ability'), null); assert.equal(calls, 0);
  const first = core.load(), second = core.load();
  assert.equal(first, second); assert.equal(calls, 1);
  release({ CEEC_MEANING_ROWS }); await first;
  assert.deepEqual(core.find('ability')!.noun, ['能力', '才幹']);
  core.find('ability')!.noun!.push('不應影響原資料');
  assert.deepEqual(core.find('ability')!.noun, ['能力', '才幹']);
  await core.load(); assert.equal(calls, 1);
});

test('a failed deferred dictionary remains retryable', async () => {
  let calls = 0;
  const core = createCeecCoreLookup(async () => { if (++calls === 1) throw new Error('offline'); return { CEEC_MEANING_ROWS }; });
  await assert.rejects(core.load(), /offline/);
  assert.equal(core.find('ability'), null);
  await core.load(); assert.deepEqual(core.find('ability')!.noun, ['能力', '才幹']);
});

test('an unloaded dictionary preserves automatic-field ownership until the actual lookup arrives', () => {
  const word: EnglishReviewWordEntry = { id: 'stable', text: 'ability', noun: true, translation: '能力',
    translationsByPartOfSpeech: { noun: ['能力'] }, vocabularyAutoFill: { version: 1, word: 'ability', dictionary: true,
      defaults: { noun: true, translation: '能力', translationsByPartOfSpeech: { noun: ['能力'] } } } };
  applyVocabularyAutoFill(word);
  const snapshot = word.vocabularyAutoFill as { defaults: Record<string, unknown> };
  assert.equal(snapshot.defaults.translation, '能力');
  assert.deepEqual(snapshot.defaults.translationsByPartOfSpeech, { noun: ['能力'] });
  word.text = 'unlisted-audit-spelling'; applyVocabularyAutoFill(word);
  assert.equal(word.translation, undefined);
  assert.equal(word.translationsByPartOfSpeech, undefined);
});
