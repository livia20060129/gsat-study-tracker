import assert from 'node:assert/strict';
import test from 'node:test';
import { completedItemsForPeriod } from '../src/study/completedItems.ts';
import { completedStudyTimeEntries } from '../src/study/completedStudyTime.ts';
import { overdueHandledTasks, overdueTasks } from '../src/study/overdueTasks.ts';
import type { StudyItem, StudyRecord } from '../src/types.ts';

function item(id: string, overrides: Partial<StudyItem> = {}): StudyItem {
  return { id, type: 'general', title: id, source: 'preset', required: true, done: false, minutes: '25', f: {}, ...overrides };
}

test('only the specified English timed mock and fixed magazine routines are excluded by title', () => {
  const excluded = ['英文歷屆／模考：限時作答', '英文歷屆/模考 : 限時作答', '英文歷屆／模考｜限時作答｜10/23',
    '學測英文訓練：英文雜誌', '學測英文訓練: 英文雜誌', '學測英文訓練：英文雜誌｜10/23'];
  const retained = ['英文歷屆／模考：批改與訂正', '數學歷屆／模考：限時作答', '英文雜誌補充閱讀', '英文輕量閱讀'];
  const record: StudyRecord = { date: '2026-10-24', items: [
    ...excluded.map(title => item(title, { title })), ...retained.map(title => item(title, { title })),
  ] };
  const before = structuredClone(record);
  assert.deepEqual(overdueTasks([record], '2026-10-25').map(entry => entry.title).sort(), [...retained].sort());
  assert.deepEqual(record, before);
});

test('legacy preset, carried template and Calendar identities exclude the fixed routines without a title dependency', () => {
  const keys = ['fri_mock_timed', 'weekday_magazine', 'fri_magazine', 'cal_fixed_englishMockTimed_event',
    'cal_fixed_fixedMagazine_event', 'cal_magazine_legacy'];
  const record: StudyRecord = { date: '2026-10-24', items: [
    ...keys.flatMap(key => [item(key, { presetKey: key }), item(`${key}-carried`, { templatePresetKey: key })]),
    ...['englishMockTimed', 'fixedMagazine'].map(template => item(template, { f: { calendarFixedTemplate: template } })),
    item('original-title', { f: { calendarOriginalTitle: '英文歷屆／模考：限時作答' } }),
    item('regular-mock', { type: 'mock', f: { subject: '英文' } }),
    item('regular-magazine', { type: 'magazine', f: { name: '常春藤' } }),
    item('correction', { type: 'mock', presetKey: 'sat_mock_correction', f: { calendarFixedTemplate: 'englishMockCorrection' } }),
  ] };
  assert.deepEqual(overdueTasks([record], '2026-10-25').map(entry => entry.itemId).sort(), ['correction', 'regular-magazine', 'regular-mock']);
});

test('mixed merged sources retain ordinary work when the timed mock and magazine are filtered', () => {
  const regular = item('science', { type: 'scienceReview', f: { subject: '物理' } });
  const record: StudyRecord = { date: '2026-10-24', items: [item('parent', { source: 'summary', required: false, f: {
    dailyWorkSourceItems: [item('timed', { presetKey: 'fri_mock_timed' }), regular],
  } }), item('grouped', { source: 'summary', required: false, f: { groupedWorkEntries: [
    item('magazine', { presetKey: 'weekday_magazine' }), item('math', { type: 'mathLecture' }),
  ] } })] };
  const before = structuredClone(record);
  assert.deepEqual(overdueTasks([record], '2026-10-25').map(entry => entry.itemId).sort(), ['math', 'science']);
  assert.deepEqual(record, before);
});

test('handled routines are hidden but their completion history and study time remain intact', () => {
  const handledAt = '2026-10-25T04:00:00Z';
  const action = { overdueTodoAction: { kind: 'complete' as const, handledAt } };
  const record: StudyRecord = { date: '2026-10-24', items: [
    item('timed', { type: 'mock', presetKey: 'fri_mock_timed', title: '英文歷屆／模考：限時作答',
      done: true, checkedOn: '2026-10-25', f: { ...action, subject: '英文' } }),
    item('magazine', { type: 'magazine', presetKey: 'weekday_magazine', title: '學測英文訓練：英文雜誌',
      done: true, checkedOn: '2026-10-25', f: { ...action, entries: [{ name: '常春藤', month: '10', unit: '2', minutes: '25' }] } }),
    item('skipped', { presetKey: 'fri_magazine', f: { overdueSkippedOn: '2026-10-25', overdueTodoAction: { kind: 'skip', handledAt } } }),
    item('correction', { type: 'mock', presetKey: 'sat_mock_correction', done: true, f: action }),
  ] };
  const before = structuredClone(record);
  const period = { start: '2026-10-25', end: '2026-10-25' };
  const completed = completedItemsForPeriod([record], period);
  const time = completedStudyTimeEntries([record]);
  assert.ok(completed.some(entry => entry.title === '英文歷屆／模考：限時作答'));
  assert.ok(completed.some(entry => entry.title === '學測英文訓練：英文雜誌'));
  assert.deepEqual(overdueHandledTasks([record], Date.parse(handledAt)).map(entry => entry.itemId), ['correction']);
  assert.deepEqual(completedItemsForPeriod([record], period), completed);
  assert.deepEqual(completedStudyTimeEntries([record]), time);
  assert.deepEqual(record, before);
});
