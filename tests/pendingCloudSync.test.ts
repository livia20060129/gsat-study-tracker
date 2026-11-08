import assert from 'node:assert/strict';
import test from 'node:test';
import { PendingCloudSync } from '../src/application/cloud/pendingCloudSync.ts';
import type { StudyRecord } from '../src/types.ts';

function storage() {
  const values = new Map<string, string>();
  return { getItem(key: string): string | null { return values.get(key) ?? null; },
    setItem(key: string, value: string): void { values.set(key, value); }, removeItem(key: string): void { values.delete(key); } };
}
const scope = 'study-v11:user:a:';
const record: StudyRecord = { date: '2026-08-03', items: [], localDirty: true };

test('queued and active dates are not requeued by background scans', () => {
  const sync = new PendingCloudSync(storage());
  assert.equal(sync.ready(scope, record), true);
  sync.queued(scope, record.date); assert.equal(sync.ready(scope, record), false);
  sync.started(scope, record.date, 100); assert.equal(sync.ready(scope, record), false);
  sync.resetActivity(scope); assert.equal(sync.ready(scope, record), true);
});

test('failed network and storage writes stay pending until an explicit retry', () => {
  const sync = new PendingCloudSync(storage());
  sync.failed(scope, record.date, 'network', false, 100);
  assert.equal(sync.ready(scope, record), false);
  for (let count = 0; count < 20; count += 1) sync.failed(scope, record.date, 'network', false, 100);
  assert.equal(sync.state(scope, record.date).retryAt, 0);
  sync.failed(scope, record.date, 'local write failed', true, 100);
  assert.equal(sync.ready(scope, record), false);
  sync.resume(scope, record.date);
  assert.equal(sync.ready(scope, record), true);
});

test('edits made during an upload return to waiting without claiming completion or another upload', () => {
  const sync = new PendingCloudSync(storage());
  sync.started(scope, record.date, 100);
  sync.waiting(scope, record.date, '有新的本機修改');
  assert.equal(sync.state(scope, record.date).phase, 'waiting');
  assert.equal(sync.state(scope, record.date).reason, '有新的本機修改');
  assert.equal(record.localDirty, true);
});

test('pause survives reopening the page and remains isolated to its account and date', () => {
  const store = storage(), sync = new PendingCloudSync(store);
  sync.pause(scope, record.date);
  const reopened = new PendingCloudSync(store);
  assert.equal(reopened.ready(scope, record), false);
  assert.equal(reopened.ready('study-v11:user:b:', record), true);
  reopened.resume(scope, record.date);
  assert.equal(reopened.ready(scope, record), true);
});

test('details list every dirty or conflicting date and preserve each failure cause', () => {
  const sync = new PendingCloudSync(storage());
  sync.failed(scope, record.date, '本機寫回失敗', true, 1234);
  const entries = sync.entries(scope, [record, { ...record, date: '2026-08-04', syncConflict: true },
    { ...record, date: '2026-08-05', localDirty: false }]);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].reason, '本機寫回失敗');
  assert.equal(entries[1].phase, 'conflict');
  assert.equal(sync.ready(scope, { ...record, syncConflict: true }), false);
});

test('confirmed saves clear only the corresponding date and failure reason', () => {
  const sync = new PendingCloudSync(storage());
  sync.failed(scope, record.date, 'first');
  sync.failed(scope, '2026-08-04', 'second');
  sync.saved(scope, record.date);
  assert.equal(sync.state(scope, record.date).phase, 'waiting');
  assert.equal(sync.state(scope, '2026-08-04').reason, 'second');
});

test('old dirty Calendar caches do not appear as pending days but real recorded changes do', () => {
  const sync = new PendingCloudSync(storage());
  const cached: StudyRecord = { date: record.date, localDirty: true, items: [{ id: 'calendar', type: 'extra',
    source: 'preset', presetKey: 'cal_ace_3', done: false, required: true, minutes: '',
    f: { title: 'ACE Reading', round: '3', calendarEventKey: 'primary:ace' } }] };
  assert.equal(sync.ready(scope, cached), false);
  assert.deepEqual(sync.entries(scope, [cached]), []);
  cached.items[0].done = true;
  assert.equal(sync.ready(scope, cached), true);
  assert.equal(sync.entries(scope, [cached]).length, 1);
});
