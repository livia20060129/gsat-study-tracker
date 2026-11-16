import assert from 'node:assert/strict';
import test from 'node:test';
import { compactConfirmedRecordStorage } from '../src/infrastructure/storage/localRecordCompaction.ts';
import { LocalStudyRecordRepository } from '../src/infrastructure/storage/localStudyRecordRepository.ts';
import { decodeStudyRecord, encodeLocalStudyRecord, encodeCompressedLocalStudyRecord, encodeStudyRecord } from '../src/storage/studyRecordCodec.ts';
import { compressLocalRecord, decompressLocalRecord, isCompressedLocalRecord } from '../src/storage/localRecordCompression.ts';
import { markRecordLocallyEdited, markRecordSynced, mergeStudyRecordsThreeWay, sameStudyContent } from '../src/storage/recordSync.ts';
import { readMaterialProgressRecords } from '../src/study/materialProgress.ts';
import type { StudyRecord } from '../src/types.ts';

class BudgetStorage {
  readonly values = new Map<string, string>();
  limit = Infinity;
  get length(): number { return this.values.size; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void {
    const size = [...this.values.entries()].reduce((total, [name, content]) => total + (name === key ? 0 : content.length), value.length);
    if (size > this.limit) throw new DOMException('full', 'QuotaExceededError');
    this.values.set(key, value);
  }
  used(): number { return [...this.values.values()].reduce((total, value) => total + value.length, 0); }
}
const prefix = 'study-v11:user:test:';
function confirmed(date = '2026-08-03'): StudyRecord {
  return markRecordSynced({ schemaVersion: 2, date, notes: '保留筆記'.repeat(600), items: [], serverRevision: 5, serverUpdatedAt: '2026-11-02T00:00:00Z' });
}

test('confirmed baseline compaction is lossless, does not mutate input, and stays out of normal JSON exports', () => {
  const record = confirmed(), original = structuredClone(record);
  const encoded = encodeLocalStudyRecord(record);
  assert.ok(encoded.length < encodeStudyRecord(record).length * 0.6);
  const decoded = decodeStudyRecord(encoded);
  assert.ok(decoded.ok);
  assert.deepEqual(decoded.record, original);
  assert.deepEqual(record, original);
  assert.equal(encodeStudyRecord(decoded.record).includes('__localSyncBase'), false);
});

test('normal encoding never elides dirty, conflicting or mismatched baselines', () => {
  for (const change of [{ localDirty: true }, { syncConflict: true }, { syncBase: { ...confirmed(), notes: '另一版本' } }]) {
    const record = { ...confirmed(), ...change };
    assert.equal(encodeLocalStudyRecord(record), encodeStudyRecord(record));
  }
});

test('quota recovery preserves confirmed and dirty contents, damaged bytes and unrelated data', () => {
  const storage = new BudgetStorage();
  storage.setItem(prefix + '2026-08-03', encodeStudyRecord(confirmed()));
  const dirty = markRecordLocallyEdited({ ...confirmed('2026-08-04'), notes: '未同步的修改' }, confirmed('2026-08-04'));
  const rawDirty = encodeStudyRecord(dirty);
  storage.setItem(prefix + dirty.date, rawDirty);
  storage.setItem(prefix + '2026-08-05', '{broken');
  storage.setItem('other-service', 'keep');
  storage.limit = storage.used() + 50;
  const repository = new LocalStudyRecordRepository(storage, prefix);
  assert.equal(repository.save({ date: '2026-08-06', notes: '新紀錄'.repeat(200), items: [], localDirty: true }), true);
  assert.equal(repository.saveError(), '');
  assert.deepEqual(repository.load(dirty.date), dirty);
  assert.equal(storage.getItem(prefix + '2026-08-05'), '{broken');
  assert.equal(storage.getItem('other-service'), 'keep');
  assert.ok(sameStudyContent(repository.load('2026-08-03'), confirmed()));
});

test('guest, pending and conflicting records round-trip in compact form with unknown fields and sync ancestors intact', () => {
  const base = confirmed();
  const pending = markRecordLocallyEdited({ ...base, notes: '實際筆記'.repeat(500) }, base);
  const conflict = { ...pending, syncConflict: true, syncConflictLocal: pending, syncConflictCloud: base,
    syncConflictDetails: [{ path: 'notes', kind: 'same-field' as const, baseExists: true, localExists: true, cloudExists: true,
      base: base.notes, local: pending.notes, cloud: base.notes }],
    futureFields: { nested: [null, '繁體中文 😀', { __protoField: '保留', omitted: undefined }], deleted: null } };
  for (const record of [{ ...pending, serverRevision: 0, syncBase: undefined }, pending, conflict]) {
    const source = JSON.parse(encodeStudyRecord(record));
    const encoded = encodeCompressedLocalStudyRecord(record);
    assert.ok(isCompressedLocalRecord(encoded));
    assert.ok(encoded.length < encodeStudyRecord(record).length * 0.4);
    const decoded = decodeStudyRecord(encoded);
    assert.ok(decoded.ok);
    assert.deepEqual(decoded.record, source);
    assert.deepEqual(decodeStudyRecord(JSON.parse(encoded)), decoded);
  }
});

test('a full store containing only guest and pending records can save a draft without deleting any day', () => {
  const storage = new BudgetStorage();
  const records = Array.from({ length: 28 }, (_, i) => ({ schemaVersion: 2, date: `2026-08-${String(i + 1).padStart(2, '0')}`,
    items: [], notes: `第 ${i + 1} 天尚未上傳的筆記。`.repeat(200), localDirty: true }));
  for (const record of records) storage.setItem('study-v11:guest:' + record.date, encodeStudyRecord(record));
  storage.limit = storage.used();
  const repository = new LocalStudyRecordRepository(storage, 'study-v11:guest:');
  const draft = { ...records[0], notes: '登入前完整草稿。'.repeat(1800) };
  assert.equal(repository.save(draft), true);
  assert.deepEqual(repository.listDates(), records.map(record => record.date));
  for (const record of records) assert.deepEqual(repository.load(record.date), record.date === draft.date ? draft : record);
  assert.ok(storage.used() < storage.limit * 0.15);
  assert.equal(compactConfirmedRecordStorage(storage), 0);
  assert.equal(repository.save({ ...draft, notes: '下次編輯'.repeat(450) }), true);
  assert.ok(isCompressedLocalRecord(storage.getItem('study-v11:guest:' + draft.date)));
});

test('damaged, oversized, truncated and nested compressed envelopes remain unreadable without changing stored bytes', () => {
  const encoded = encodeCompressedLocalStudyRecord({ ...confirmed(), localDirty: true });
  const envelope = JSON.parse(encoded);
  for (const value of [
    [envelope[0], envelope[1], '!bad base64'],
    [envelope[0], envelope[1], envelope[2].slice(0, -12)],
    [envelope[0], 2, envelope[2]],
    [envelope[0], 33 * 1024 * 1024, envelope[2]],
    ['gsat-local-record:future-version', envelope[1], envelope[2]],
    [envelope[0], envelope[1] + 10, envelope[2]],
  ]) {
    const raw = JSON.stringify(value), storage = new BudgetStorage();
    storage.setItem(prefix + '2026-08-03', raw);
    assert.equal(decodeStudyRecord(raw).ok, false);
    assert.equal(compactConfirmedRecordStorage(storage), 0);
    assert.equal(storage.getItem(prefix + '2026-08-03'), raw);
  }
  assert.throws(() => {
    const nested = compressLocalRecord(JSON.stringify(Array(1000).fill('nested')));
    decompressLocalRecord(JSON.parse(nested));
  });
  assert.equal(compressLocalRecord('{"small":true}'), '{"small":true}');
});

test('compressed history restores a valid common ancestor for three-way cloud merge and plain JSON export', () => {
  const storage = new BudgetStorage(), base = confirmed();
  const pending = markRecordLocallyEdited({ ...base, notes: '本機未同步筆記' }, base);
  storage.setItem('study-v11:meta:active-record-prefix', prefix);
  storage.setItem(prefix + pending.date, encodeCompressedLocalStudyRecord(pending));
  const local = readMaterialProgressRecords(storage).records[0];
  const merged = mergeStudyRecordsThreeWay(local, { ...base, mood: '普通', serverRevision: 6 });
  assert.deepEqual(merged.conflicts, []);
  assert.equal(merged.record.notes, pending.notes);
  assert.equal(merged.record.mood, '普通');
  const exported = JSON.parse(encodeStudyRecord(local));
  assert.equal(Array.isArray(exported), false);
  assert.deepEqual(exported, pending);
});

test('unrecoverable quota failures preserve the original record and report a specific cause', () => {
  const storage = new BudgetStorage();
  const original = { date: '2026-08-03', items: [], notes: '原本資料', localDirty: true };
  storage.setItem(prefix + original.date, encodeStudyRecord(original));
  storage.limit = storage.used();
  const repository = new LocalStudyRecordRepository(storage, prefix);
  assert.equal(repository.save({ ...original, notes: '不能丟失'.repeat(1000) }), false);
  assert.match(repository.saveError(), /空間不足/);
  assert.equal(repository.load(original.date)?.notes, original.notes);
  assert.equal(compactConfirmedRecordStorage(storage), 0);
});

test('standalone pages hydrate compact baselines and retain a valid ancestor for three-way edits', () => {
  const storage = new BudgetStorage(), original = confirmed();
  storage.setItem('study-v11:meta:active-record-prefix', prefix);
  storage.setItem(prefix + original.date, encodeLocalStudyRecord(original));
  const local = readMaterialProgressRecords(storage).records[0];
  assert.deepEqual(local.syncBase, original.syncBase);
  local.notes = '本機新筆記';
  const cloud = { ...original, mood: '普通', serverRevision: 6 };
  const merged = mergeStudyRecordsThreeWay(local, cloud);
  assert.deepEqual(merged.conflicts, []);
  assert.equal(merged.record.notes, '本機新筆記');
  assert.equal(merged.record.mood, '普通');
});

test('invalid compact markers cannot manufacture a baseline for unsynced records', () => {
  for (const localDirty of [true, undefined]) {
    const decoded = decodeStudyRecord({ ...confirmed(), syncBase: undefined, localDirty, __localSyncBase: 'same-content-v1' });
    assert.ok(decoded.ok);
    assert.equal(decoded.record.syncBase, undefined);
    assert.equal(decoded.record.localDirty, localDirty);
  }
  assert.equal(decodeStudyRecord({ ...confirmed(), __localSyncBase: 'unknown-version' }).ok, false);
});
