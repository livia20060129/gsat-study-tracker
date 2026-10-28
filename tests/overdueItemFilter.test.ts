import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizedOverdueItemFilter, overdueEntriesForItem, overdueItemKey, overdueItemOptions } from '../src/study/overdueItemFilter.ts';
import { overdueEntriesForPeriod } from '../src/study/overduePeriod.ts';
import { overdueTasks } from '../src/study/overdueTasks.ts';
import type { OverdueItemSubject } from '../src/study/overdueTasks.ts';
import type { StudyRecord } from '../src/types.ts';

function entry(subject: OverdueItemSubject, title: string, recordDate = '2026-10-27') {
  return { subject, subjectLabel: subject === 'english' ? '英文' : '自然', title, recordDate };
}

test('item options group identical titles across dates, separate subjects and have stable ordering', () => {
  const entries = [entry('natural', '共同項目'), entry('english', 'ACE Reading', '2026-09-30'),
    entry('english', 'ACE Reading'), entry('english', '共同項目')];
  const snapshot = structuredClone(entries);
  const options = overdueItemOptions(entries);
  assert.equal(options.length, 3);
  assert.ok(options.slice(0, 2).every(option => option.value.startsWith('english:')));
  assert.ok(options.some(option => option.label === '英文｜ACE Reading'));
  assert.deepEqual(options, overdueItemOptions([...entries].reverse()));
  assert.notEqual(overdueItemKey(entries[0]), overdueItemKey(entries[3]));
  assert.deepEqual(entries, snapshot);
});

test('item and period filtering intersect without mutating, reordering or copying individual entries', () => {
  const entries = [entry('english', 'ACE Reading', '2026-09-30'), entry('natural', '物理'), entry('english', 'ACE Reading')];
  const snapshot = structuredClone(entries);
  assert.deepEqual(overdueEntriesForItem(entries, ''), entries);
  const key = overdueItemKey(entries[0]);
  assert.deepEqual(overdueEntriesForItem(entries, key), [entries[0], entries[2]]);
  const filtered = overdueEntriesForItem(overdueEntriesForPeriod(entries, 'week', '2026-10-28'), key);
  assert.deepEqual(filtered, [entries[2]]);
  assert.equal(filtered[0], entries[2]);
  assert.deepEqual(overdueEntriesForItem(entries, 'english:已無待辦'), []);
  assert.deepEqual(entries, snapshot);
});

test('item URL values normalize safely and preserve punctuation in real titles', () => {
  for (const value of [null, undefined, 1, '', 'all', 'all:全部', '__proto__:x', 'unknown:x', 'english:  ']) {
    assert.equal(normalizedOverdueItemFilter(value), '');
  }
  assert.equal(normalizedOverdueItemFilter('english:  主題：A & B／"C"  '), 'english:主題：A & B／"C"');
  const key = overdueItemKey(entry('english', '<標題> & / Unit 1'));
  const url = new URL('https://example.test/todo.html?period=week#english');
  url.searchParams.set('item', key);
  assert.equal(normalizedOverdueItemFilter(url.searchParams.get('item')), key);
});

test('options are derived only from eligible overdue work and preserve all source records', () => {
  const record: StudyRecord = { date: '2026-10-27', items: [
    { id: 'ace', type: 'extra', title: 'ACE Reading', required: true, source: 'preset', done: false, minutes: '12', f: { title: 'ACE Reading', round: '1' } },
    { id: 'interactive', type: 'interactiveDaily', title: '互動題', required: true, done: false, minutes: '', f: {} },
    { id: 'done', type: 'scienceReview', title: '已完成', required: true, done: true, minutes: '20', f: { subject: '物理' } },
  ] };
  const snapshot = structuredClone(record);
  const options = overdueItemOptions(overdueTasks([record], '2026-10-28'));
  assert.deepEqual(options, [{ value: 'english:ACE Reading', label: '英文｜ACE Reading' }]);
  assert.deepEqual(record, snapshot);
});
