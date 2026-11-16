import assert from 'node:assert/strict';
import test from 'node:test';
import { LocalRecordHistory, readBrowserRecordHistory } from '../src/infrastructure/storage/localRecordHistory.ts';
import { LocalStudyRecordRepository } from '../src/infrastructure/storage/localStudyRecordRepository.ts';
import { encodeCompressedLocalStudyRecord } from '../src/storage/studyRecordCodec.ts';
import { isCompressedLocalRecord } from '../src/storage/localRecordCompression.ts';

function storageFixture() {
  const values = new Map<string, string>();
  let reads = 0;
  const storage = {
    get length() { return values.size; },
    key(index: number) { return [...values.keys()][index] ?? null; },
    getItem(key: string) { reads++; return values.get(key) ?? null; },
    setItem(key: string, value: string) { values.set(key, value); },
    removeItem(key: string) { values.delete(key); },
  };
  return { storage, reads: () => reads };
}
const prefix = 'study-v11:guest:';

test('history reuses unchanged days, reads only an invalidated date and never exposes mutable cached records', () => {
  const { storage, reads } = storageFixture();
  const repository = new LocalStudyRecordRepository(storage, prefix);
  for (const date of ['2026-11-03', '2026-11-04']) repository.save({ date, items: [], notes: date });
  const beforeHistory = reads();
  const history = new LocalRecordHistory(storage);
  const first = history.read(prefix);
  assert.equal(reads() - beforeHistory, 2);
  assert.equal(history.read(prefix)[0], first[0]);
  assert.equal(reads() - beforeHistory, 2);
  assert.throws(() => { first[0].notes = '不應更改快取'; }, TypeError);
  storage.setItem(prefix + '2026-11-04', JSON.stringify({ date: '2026-11-04', items: [], notes: '新內容' }));
  history.invalidate(prefix + '2026-11-04');
  assert.equal(history.read(prefix)[1].notes, '新內容');
  assert.equal(reads() - beforeHistory, 3);
});

test('repository saves and deletes invalidate shared history, while account switches and damaged rows stay isolated', () => {
  const { storage } = storageFixture();
  const repository = new LocalStudyRecordRepository(storage, prefix);
  repository.save({ date: '2026-11-04', items: [], notes: '訪客' });
  assert.equal(readBrowserRecordHistory(storage, prefix)[0].notes, '訪客');
  repository.save({ date: '2026-11-04', items: [], notes: '已更新' });
  assert.equal(readBrowserRecordHistory(storage, prefix)[0].notes, '已更新');
  const account = 'study-v11:user:other:';
  storage.setItem(account + '2026-11-04', JSON.stringify({ date: '2026-11-04', items: [], notes: '另一帳號' }));
  assert.equal(readBrowserRecordHistory(storage, account)[0].notes, '另一帳號');
  assert.equal(readBrowserRecordHistory(storage, prefix)[0].notes, '已更新');
  repository.remove('2026-11-04');
  assert.deepEqual(readBrowserRecordHistory(storage, prefix), []);
  storage.setItem(prefix + '2026-11-04', '{invalid');
  assert.deepEqual(readBrowserRecordHistory(storage, prefix, true), []);
});

test('a reported metadata insertion does not make the next date change reread the whole history', () => {
  const { storage, reads } = storageFixture();
  for (const date of ['2026-11-03', '2026-11-04']) storage.setItem(prefix + date, JSON.stringify({ date, items: [] }));
  const history = new LocalRecordHistory(storage);
  history.read(prefix);
  storage.setItem('study-v11:meta:other', '1');
  history.invalidate('study-v11:meta:other');
  storage.setItem(prefix + '2026-11-04', JSON.stringify({ date: '2026-11-04', items: [], notes: '新內容' }));
  history.invalidate(prefix + '2026-11-04');
  assert.equal(history.read(prefix)[1].notes, '新內容');
  assert.equal(reads(), 3);
});

test('saving a freshly loaded day reuses its format without another read and never caches record contents', () => {
  const { storage, reads } = storageFixture(), date = '2026-11-04';
  storage.setItem(prefix + date, JSON.stringify({ schemaVersion: 2, date, items: [], notes: '原筆記' }));
  const repository = new LocalStudyRecordRepository(storage, prefix);
  const record = repository.load(date)!;
  assert.equal(reads(), 1);
  assert.equal(repository.save({ ...record, mood: '普通' }), true);
  assert.equal(reads(), 1);
  storage.setItem(prefix + date, JSON.stringify({ ...record, notes: '另一頁籤的新筆記' }));
  const latest = repository.load(date)!;
  assert.equal(latest.notes, '另一頁籤的新筆記');
  assert.equal(repository.save({ ...latest, mood: '普通' }), true);
  assert.equal(reads(), 2);
  assert.equal(repository.load(date)!.notes, latest.notes);
});

test('compressed dates stay compressed after a read or a direct save without repeated format reads', () => {
  for (const readFirst of [false, true]) {
    const { storage, reads } = storageFixture(), date = '2026-11-04';
    const record = { schemaVersion: 2, date, items: [], notes: '保留尚未同步的筆記。'.repeat(500), localDirty: true };
    storage.setItem(prefix + date, encodeCompressedLocalStudyRecord(record));
    const repository = new LocalStudyRecordRepository(storage, prefix);
    if (readFirst) assert.deepEqual(repository.load(date), record);
    assert.equal(repository.save({ ...record, mood: '普通' }), true);
    assert.equal(repository.save({ ...record, mood: '普通', firstThingTomorrow: '明日重點' }), true);
    assert.equal(reads(), 1);
    assert.ok(isCompressedLocalRecord(storage.getItem(prefix + date)));
    assert.equal(repository.load(date)!.firstThingTomorrow, '明日重點');
  }
});

test('encoding hints cannot cross account prefixes or dates and removal drops the hint', () => {
  const { storage, reads } = storageFixture(), date = '2026-11-04', anotherDate = '2026-11-03';
  const record = { schemaVersion: 2, date, items: [], notes: '帳號紀錄'.repeat(500) };
  const accountPrefix = 'study-v11:user:other:';
  storage.setItem(prefix + date, JSON.stringify(record));
  storage.setItem(prefix + anotherDate, encodeCompressedLocalStudyRecord({ ...record, date: anotherDate }));
  storage.setItem(accountPrefix + date, encodeCompressedLocalStudyRecord(record));
  const repository = new LocalStudyRecordRepository(storage, prefix);
  repository.load(date);
  assert.equal(repository.save({ ...record, date: anotherDate }), true);
  assert.equal(reads(), 2);
  assert.ok(isCompressedLocalRecord(storage.getItem(prefix + anotherDate)));
  repository.setPrefix(accountPrefix);
  const beforeAccount = reads();
  assert.equal(repository.save(record), true);
  assert.equal(reads() - beforeAccount, 1);
  assert.ok(isCompressedLocalRecord(storage.getItem(accountPrefix + date)));
  repository.remove(date);
  const beforeNew = reads();
  assert.equal(repository.save(record), true);
  assert.equal(reads() - beforeNew, 1);
  assert.equal(isCompressedLocalRecord(storage.getItem(accountPrefix + date)), false);
});
