import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseProgressImportText,
  progressImportBackupPayload,
  progressImportResultText,
} from '../src/application/progressImport.ts';

test('progress import parses supported single, array, records and date-map shapes', () => {
  const samples = [
    JSON.stringify({ date: '2026-09-03', items: [] }),
    JSON.stringify([{ date: '2026-09-03', items: [] }]),
    JSON.stringify({ records: [{ date: '2026-09-03', items: [] }] }),
    JSON.stringify({ '2026-09-03': { items: [] } }),
  ];

  for (const sample of samples) {
    const parsed = parseProgressImportText(sample);
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.records[0]?.date, '2026-09-03');
  }
});

test('progress import rejects the complete batch when any record is invalid', () => {
  const parsed = parseProgressImportText(JSON.stringify([
    { date: '2026-09-03', items: [] },
    { date: '2026-02-30', items: [] },
  ]));

  assert.equal(parsed.ok, false);
  if (!parsed.ok) assert.match(parsed.errors.join(' '), /第 2 筆紀錄/);
});

test('progress import rejects invalid item fields and mismatched date-map dates', () => {
  const badItems = parseProgressImportText(JSON.stringify({ date: '2026-09-03', items: {} }));
  assert.equal(badItems.ok, false);

  const mismatched = parseProgressImportText(JSON.stringify({
    '2026-09-03': { date: '2026-09-04', items: [] },
  }));
  assert.equal(mismatched.ok, false);
  if (!mismatched.ok) assert.match(mismatched.errors.join(' '), /不一致/);
});

test('progress import result reports every local and cloud outcome', () => {
  assert.equal(progressImportResultText({
    localSucceeded: 4,
    localFailed: 1,
    cloudSucceeded: 2,
    cloudConflicts: 1,
    cloudFailed: 1,
    cloudSkipped: 0,
  }), '本機成功 4 筆、失敗 1 筆；雲端成功 2 筆、衝突 1 筆、失敗 1 筆、未同步 0 筆。');
});

test('progress import backup is a detached copy', () => {
  const source = [{ date: '2026-09-03', items: [], notes: 'before' }];
  const backup = progressImportBackupPayload(source, '2026-09-03T00:00:00.000Z');
  source[0].notes = 'after';
  assert.equal(backup.records[0]?.notes, 'before');
  assert.equal(backup.createdAt, '2026-09-03T00:00:00.000Z');
});
