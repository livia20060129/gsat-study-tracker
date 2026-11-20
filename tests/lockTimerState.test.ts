import assert from 'node:assert/strict';
import test from 'node:test';
import { applyLockTimerState, type LockTimerSession } from '../src/native/lockTimerState.ts';
import { LocalStudyRecordRepository } from '../src/infrastructure/storage/localStudyRecordRepository.ts';
import type { StudyRecord } from '../src/types.ts';

const scope = 'study-v11:guest:', date = '2026-11-18', itemId = 'timer-source';
function fixture() {
  const values = new Map<string, string>([['study-v11:meta:active-record-prefix', scope]]);
  let failWrites = false;
  const storage = { get length() { return values.size; }, key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null, removeItem: (key: string) => { values.delete(key); },
    setItem(key: string, value: string) { if (failWrites) throw new Error('blocked'); values.set(key, value); } };
  const record: StudyRecord = { date, notes: '保留最新筆記', items: [{ id: itemId, type: 'extra', minutes: '2', required: true, done: false,
    f: { title: '三角函數', words: ['preserve'], timeTracking: { mode: 'timer', accumulatedSeconds: 120, startedAt: 100000 } } }] };
  values.set(scope + date, JSON.stringify(record)); values.set(scope + 'active-timer', JSON.stringify({ date, itemId }));
  const session: LockTimerSession = { id: 'native-test-session', scope, date, itemId, title: '三角函數', revision: 2,
    accumulatedSeconds: 185, startedAt: null, baseAccumulatedSeconds: 120, baseStartedAt: 100000 };
  const read = () => new LocalStudyRecordRepository(storage, scope).load(date)!;
  return { storage, values, record, session, read, fail: () => { failWrites = true; } };
}
test('lock pause changes only the source timer, preserves notes and minutes, marks dirty and clears its pointer', () => {
  const f = fixture(); assert.equal(applyLockTimerState(f.storage, f.session), 'applied');
  const saved = f.read(); assert.equal(saved.notes, f.record.notes); assert.equal(saved.items[0].minutes, '2');
  assert.deepEqual(saved.items[0].f.words?.map(word => typeof word === 'string' ? word : word.text), ['preserve']); assert.equal(saved.localDirty, true);
  assert.deepEqual(saved.items[0].f.timeTracking, { mode: 'timer', accumulatedSeconds: 185, startedAt: null });
  assert.equal(f.values.has(scope + 'active-timer'), false);
});
test('duplicate native delivery does not change the saved record again', () => {
  const f = fixture(); applyLockTimerState(f.storage, f.session); const before = f.values.get(scope + date);
  assert.equal(applyLockTimerState(f.storage, f.session), 'applied'); assert.equal(f.values.get(scope + date), before);
});
test('a native resume restores its stable source pointer without writing a rounded minute value', () => {
  const f = fixture(); f.session.startedAt = 200000;
  assert.equal(applyLockTimerState(f.storage, f.session), 'applied');
  assert.deepEqual(JSON.parse(f.values.get(scope + 'active-timer')!), { date, itemId }); assert.equal(f.read().items[0].minutes, '2');
});
test('another account cannot receive pending native work', () => {
  const f = fixture(); f.values.set('study-v11:meta:active-record-prefix', 'study-v11:user:other:');
  const before = [...f.values]; assert.equal(applyLockTimerState(f.storage, f.session), 'other-account'); assert.deepEqual([...f.values], before);
});
test('a newer web timer edit or reset wins over an obsolete lock-screen action', () => {
  const f = fixture(); f.record.items[0].f.timeTracking = { mode: 'timer', accumulatedSeconds: 0, startedAt: null };
  f.values.set(scope + date, JSON.stringify(f.record)); const before = [...f.values];
  assert.equal(applyLockTimerState(f.storage, f.session), 'stale'); assert.deepEqual([...f.values], before);
});
test('an old native resume cannot replace another item that is now running', () => {
  const f = fixture(); f.session.startedAt = 200000; f.values.set(scope + 'active-timer', JSON.stringify({ date, itemId: 'newer-item' }));
  assert.equal(applyLockTimerState(f.storage, f.session), 'stale'); assert.equal(f.read().items[0].f.timeTracking?.startedAt, 100000);
});
test('a native pause on an older item never removes the newer active pointer', () => {
  const f = fixture(); f.values.set(scope + 'active-timer', JSON.stringify({ date, itemId: 'newer-item' }));
  assert.equal(applyLockTimerState(f.storage, f.session), 'applied'); assert.equal(JSON.parse(f.values.get(scope + 'active-timer')!).itemId, 'newer-item');
});
test('completion, deletion and retired schedule rows cannot be revived by a native action', () => {
  for (const kind of ['done', 'deleted', 'archived']) {
    const f = fixture(); if (kind === 'done') f.record.items[0].done = true;
    if (kind === 'deleted') f.record.items = [];
    if (kind === 'archived') f.record.items[0].f.calendarScheduleArchived = true;
    f.values.set(scope + date, JSON.stringify(f.record)); assert.equal(applyLockTimerState(f.storage, f.session), 'stale');
  }
});
test('failed storage and malformed source records remain unacknowledged and untouched', () => {
  const f = fixture(), before = [...f.values]; f.fail();
  assert.equal(applyLockTimerState(f.storage, f.session), 'failed'); assert.deepEqual([...f.values], before);
  const corrupt = fixture(); corrupt.values.set(scope + date, '{broken');
  assert.equal(applyLockTimerState(corrupt.storage, corrupt.session), 'failed'); assert.equal(corrupt.values.get(scope + date), '{broken');
});
test('a magazine row uses its entry id and never overwrites a neighbouring timer', () => {
  const f = fixture(); const state = f.record.items[0].f.timeTracking;
  f.record.items[0].type = 'magazine'; f.record.items[0].f.entries = [{ id: 'row-one', minutes: '2', timeTracking: state }, { id: 'row-two', minutes: '9' }];
  f.values.set(scope + date, JSON.stringify(f.record)); f.session.entryId = 'row-one';
  f.values.set(scope + 'active-timer', JSON.stringify({ date, itemId, entryId: 'row-one' }));
  assert.equal(applyLockTimerState(f.storage, f.session), 'applied');
  const rows = f.read().items[0].f.entries as { timeTracking?: { accumulatedSeconds: number }; minutes: string }[];
  assert.equal(rows[0].timeTracking?.accumulatedSeconds, 185); assert.equal(rows[1].minutes, '9');
});
