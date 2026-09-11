import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVE_RECORD_PREFIX_KEY,
  activeStudyRecordPrefix,
  materialProgressRows,
  readMaterialProgressRecords,
} from '../src/study/materialProgress.ts';
import type { StudyItem, StudyRecord } from '../src/types.ts';

function item(overrides: Partial<StudyItem> = {}): StudyItem {
  return {
    id: 'item',
    type: 'general',
    done: false,
    minutes: '',
    required: true,
    f: {},
    ...overrides,
  };
}

function record(items: StudyItem[], date = '2026-09-11'): StudyRecord {
  return { date, items };
}

test('leaves unrecorded material segments empty and alternates segment tones', () => {
  const rows = materialProgressRows([]);
  const ace = rows.find(row => row.id === 'english:ace');
  assert.ok(ace);
  assert.equal(ace.recorded, 0);
  assert.equal(ace.total, 60);
  assert.deepEqual(ace.segments.slice(0, 4).map(segment => segment.tone), ['deep', 'light', 'deep', 'light']);
  assert.ok(ace.segments.every(segment => !segment.recorded));
});

test('reads a recorded math range from a grouped child without filling untouched units', () => {
  const child = item({
    id: 'math-child',
    type: 'mathLecture',
    f: { material: '教學講義', book: '1', start: '149', end: '165', progress: true },
  });
  const parent = item({ id: 'group', f: { groupedWorkEntries: [child] } });
  const math = materialProgressRows([record([parent])]).find(row => row.id === 'math:教學講義:1');
  assert.ok(math);
  assert.equal(math.recorded, 1);
  assert.match(math.segments.find(segment => segment.recorded)?.label ?? '', /多項式及其運算/);
});

test('does not let a grouped parent fill the interrupted range between its source children', () => {
  const first = item({
    id: 'first', type: 'mathLecture', done: true,
    f: { material: '教學講義', book: '1', start: '1', end: '15' },
  });
  const third = item({
    id: 'third', type: 'mathLecture', done: true,
    f: { material: '教學講義', book: '1', start: '34', end: '43' },
  });
  const parent = item({
    id: 'grouped', type: 'mathLecture', done: true,
    f: { material: '教學講義', book: '1', start: '1', end: '43', groupedWorkEntries: [first, third] },
  });
  const math = materialProgressRows([record([parent])]).find(row => row.id === 'math:教學講義:1');
  assert.ok(math);
  assert.equal(math.recorded, 2);
  assert.deepEqual(math.segments.slice(0, 3).map(segment => segment.recorded), [true, false, true]);
});

test('requires actual activity before an English topic round is filled', () => {
  const untouched = item({
    id: 'untouched',
    type: 'extra',
    f: { title: '主題百匯：篇章結構·閱讀測驗', topic: '科技生活', round: '第一回' },
  });
  const written = item({
    id: 'written',
    type: 'extra',
    minutes: '18',
    f: { title: '主題百匯：篇章結構·閱讀測驗', topic: '科技生活', round: '第二回' },
  });
  const row = materialProgressRows([record([untouched, written])]).find(value => value.id === 'book:主題百匯：篇章結構·閱讀測驗');
  assert.ok(row);
  assert.equal(row.recorded, 1);
  assert.match(row.segments.find(segment => segment.recorded)?.label ?? '', /第二回/);
});

test('includes completed Calendar natural integration child ranges', () => {
  const calendar = item({
    id: 'calendar-natural',
    type: 'scienceReview',
    f: {
      calendarIntegrationEntries: [
        { subject: '生物', material: '123日的淬鍊', ranges: [[58, 62]], done: true },
      ],
    },
  });
  const biology = materialProgressRows([record([calendar])]).find(row => row.id === 'natural:生物:123日的淬鍊');
  assert.ok(biology);
  assert.equal(biology.recorded, 1);
  assert.match(biology.segments.find(segment => segment.recorded)?.label ?? '', /Chapter 2 遺傳/);
});

test('uses the Tracker active account prefix and ignores other account records', () => {
  const values = new Map<string, string>([
    [ACTIVE_RECORD_PREFIX_KEY, 'study-v11:user:user-a:'],
    ['study-v11:user:user-a:2026-09-11', JSON.stringify(record([], '2026-09-11'))],
    ['study-v11:user:user-b:2026-09-12', JSON.stringify(record([], '2026-09-12'))],
  ]);
  const keys = [...values.keys()];
  const storage = {
    get length() { return keys.length; },
    key(index: number) { return keys[index] ?? null; },
    getItem(key: string) { return values.get(key) ?? null; },
  } as Pick<Storage, 'length' | 'key' | 'getItem'>;

  assert.equal(activeStudyRecordPrefix(storage), 'study-v11:user:user-a:');
  const result = readMaterialProgressRecords(storage);
  assert.equal(result.prefix, 'study-v11:user:user-a:');
  assert.deepEqual(result.records.map(value => value.date), ['2026-09-11']);
});
