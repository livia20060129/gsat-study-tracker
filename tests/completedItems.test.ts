import assert from 'node:assert/strict';
import test from 'node:test';
import type { StudyItem, StudyRecord } from '../src/types.ts';
import { completedItemsForPeriod } from '../src/study/completedItems.ts';
import { summarizeLearningPeriod, summaryPeriod } from '../src/study/learningSummary.ts';

const week = summaryPeriod('2026-10-17', 'week');

function item(id: string, overrides: Partial<StudyItem> = {}): StudyItem {
  return { id, type: 'englishPractice', title: id, done: true, minutes: '', required: true,
    source: 'preset', f: {}, ...overrides };
}

test('membership uses actual completion dates, including early/late work outside the scheduled period', () => {
  const records: StudyRecord[] = [
    { date: '2026-09-30', items: [item('late', { checkedOn: '2026-10-12' })] },
    { date: '2026-11-01', items: [item('early', { checkedOn: '2026-10-18' })] },
    { date: '2026-10-17', mood: '外出', items: [item('legacy'), item('open', { done: false }),
      item('next-week', { checkedOn: '2026-10-19' }), item('last-week', { checkedOn: '2026-10-11' })] },
  ];
  assert.deepEqual(completedItemsForPeriod(records, week).map(row => [row.title, row.date]), [
    ['early', '2026-10-18'], ['legacy', '2026-10-17'], ['late', '2026-10-12'],
  ]);
  assert.equal(completedItemsForPeriod(records, summaryPeriod('2026-10-17', 'month')).length, 5);
});

test('all status days, optional and weekly tasks count as accomplishments even without minutes', () => {
  const records: StudyRecord[] = ['外出', '身體不適', '較疲累'].map((mood, index) => ({
    date: `2026-10-${15 + index}`, mood, items: [item(`status-${index}`, {
      required: false, minutes: index === 0 ? '0' : '', f: { calendarRoute: 'week' },
    })],
  }));
  assert.equal(completedItemsForPeriod(records, week).length, 3);
});

test('lists only completed leaves, not aggregate parents or duplicate hidden sources', () => {
  const source = item('source', { f: { book: 'Azar 英文文法', start: '18', end: '21' } });
  const displayed = item('displayed', { f: { dailyWorkSourceItems: [source] } });
  const parent = item('parent', { done: false, f: {
    groupedWorkEntries: [displayed, item('pending-child', { done: false })],
    dailyWorkSourceItems: [source],
  } });
  const result = completedItemsForPeriod([{ date: '2026-10-17', items: [parent, source] }], week);
  assert.equal(result.length, 1);
  assert.equal(result[0].title, 'source');
  assert.equal(result[0].detail, 'Azar 英文文法｜p.18–21');
});

test('deferred completion and its original appear only once, including nested carried children', () => {
  const original = item('original', { deferred: true, deferredTargetDay: 6,
    deferredCompletedOn: '2026-10-17' });
  const child = item('child', { checkedOn: '2026-10-17' });
  const records: StudyRecord[] = [
    { date: '2026-10-05', items: [original, item('original-parent', { f: { interactiveEntries: [child] } })] },
    { date: '2026-10-17', items: [
      item('carry', { deferredCarry: true, deferredOriginId: 'original',
        deferredOriginDate: '2026-10-05', checkedOn: '2026-10-17' }),
      item('carry-parent', { deferredCarry: true, deferredOriginDate: '2026-10-05',
        checkedOn: '2026-10-17', f: { interactiveEntries: [child] } }),
      item('not-done-carry', { done: false, deferredCarry: true }),
    ] },
  ];
  const entries = completedItemsForPeriod(records, week);
  assert.equal(entries.length, 2);
  assert.ok(entries.every(entry => entry.recordDate === '2026-10-05' && entry.date === '2026-10-17'));
});

test('Calendar duplicates collapse but different scopes and separate scheduled days remain distinct', () => {
  const calendar = item('calendar', { f: { calendarEventKey: 'event:occurrence', start: '4', end: '10' } });
  const records: StudyRecord[] = [
    { date: '2026-10-16', items: [calendar, item('same-preset-id')] },
    { date: '2026-10-17', items: [
      { ...calendar, id: 'calendar-copy' },
      { ...calendar, id: 'other-scope', f: { ...calendar.f, start: '11', end: '20' } },
      item('same-preset-id'),
    ] },
  ];
  const rows = completedItemsForPeriod(records, week);
  assert.equal(rows.length, 4);
  assert.equal(rows.filter(row => row.title === 'same-preset-id').length, 2);
});

test('natural integration, reviews and makeup use completed child dates and inherited labels', () => {
  const records: StudyRecord[] = [{ date: '2026-10-10', items: [
    item('integration', { checkedOn: '2026-10-17', f: { calendarIntegrationEntries: [
      { id: 'bio', subject: '生物', done: true, pageText: 'p.4–57', chapterText: '細胞' },
      { id: 'chem', subject: '化學', done: false },
    ] } }),
    item('review-parent', { checkedOn: '2026-10-16', f: { reviewEntries: [item('review')] } }),
    item('makeup-parent', { checkedOn: '2026-10-15', f: { makeupEntries: [item('makeup')] } }),
  ] }];
  assert.deepEqual(completedItemsForPeriod(records, week).map(row => [row.title, row.subject, row.date]), [
    ['integration', '生物', '2026-10-17'], ['review', '英文', '2026-10-16'], ['makeup', '英文', '2026-10-15'],
  ]);
  assert.match(completedItemsForPeriod(records, week)[0].detail, /p.4–57/);
});

test('inactive English options and correction cards remain excluded', () => {
  const records: StudyRecord[] = [{ date: '2026-10-17', englishTaskChoice: 'mixed', items: [
    item('mixed', { type: 'englishMixedWriting' }),
    item('mock', { type: 'mock', presetKey: 'fri_mock_timed' }),
    item('hidden-correction', { f: { englishMockCorrectionInactive: true } }),
  ] }];
  assert.deepEqual(completedItemsForPeriod(records, week).map(row => row.title), ['mixed']);
});

test('invalid dates and unfinished items never produce rows; empty periods stay empty', () => {
  assert.deepEqual(completedItemsForPeriod([
    { date: '2026-02-30', items: [item('bad-record')] },
    { date: '2026-10-17', items: [item('bad-completion', { checkedOn: '2026-02-30' }),
      item('pending', { done: false, checkedOn: '2026-10-17' })] },
  ], week), []);
  assert.deepEqual(completedItemsForPeriod([], week), []);
});

test('listing does not mutate saved data or change time/completion metrics', () => {
  const records: StudyRecord[] = [{ date: '2026-10-17', mood: '身體不適', items: [
    item('done', { minutes: '30' }), item('open', { done: false }),
  ] }];
  const before = JSON.stringify(records);
  const metrics = summarizeLearningPeriod(records, week);
  assert.equal(completedItemsForPeriod(records, week).length, 1);
  assert.equal(JSON.stringify(records), before);
  assert.deepEqual(summarizeLearningPeriod(records, week), metrics);
});
