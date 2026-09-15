import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  calendarLeadingBlankCount,
  completedStudyTimeEntries,
  completedSubjectTimeForRecord,
  fixedPeriodRemarks,
  formatClockMinutes,
  shiftSummaryAnchor,
  summarizeLearningPeriod,
  summarizeStudyItemTime,
  summaryCompletionUnitsForRecord,
  summaryPeriod,
} from '../src/study/learningSummary.ts';
import { summarizeCompletionUnits } from '../src/study/completionMetrics.ts';
import type { StudyItem, StudyRecord } from '../src/types.ts';

function item(id: string, done: boolean, minutes: string, subject: string, required = true): StudyItem {
  return { id, type: 'general', done, minutes, required, source: required ? 'preset' : 'custom', f: { subject } };
}

function record(date: string, items: StudyItem[], wakeTime = ''): StudyRecord {
  return { date, items, wakeTime };
}

test('one anchor creates a Monday-to-Sunday week or the complete selected month', () => {
  const week = summaryPeriod('2026-09-17', 'week');
  assert.equal(week.start, '2026-09-14');
  assert.equal(week.end, '2026-09-20');
  assert.equal(week.dates.length, 7);

  const month = summaryPeriod('2026-09-17', 'month');
  assert.equal(month.start, '2026-09-01');
  assert.equal(month.end, '2026-09-30');
  assert.equal(month.dates.length, 30);
  assert.equal(calendarLeadingBlankCount(month), 1);
});

test('previous and next controls move the shared anchor by exactly one period', () => {
  assert.equal(shiftSummaryAnchor('2026-09-17', 'week', -1), '2026-09-10');
  assert.equal(shiftSummaryAnchor('2026-09-17', 'week', 1), '2026-09-24');
  assert.equal(shiftSummaryAnchor('2026-09-17', 'month', -1), '2026-08-01');
  assert.equal(shiftSummaryAnchor('2026-09-17', 'month', 1), '2026-10-01');
});

test('summary reuses completion rules and only counts time on completed work', () => {
  const studyRecord = record('2026-09-15', [
    item('done-math', true, '30', '數學A'),
    item('open-english', false, '45', '英文'),
    item('custom-chinese', true, '15', '國文', false),
  ], '06:40');

  const completion = summarizeCompletionUnits(summaryCompletionUnitsForRecord(studyRecord));
  assert.equal(completion.itemCompleted, 1);
  assert.equal(completion.itemTotal, 2);
  assert.equal(completion.workloadCompleted, 2);
  assert.equal(completion.workloadTotal, 3);

  const subjectTime = completedSubjectTimeForRecord(studyRecord);
  assert.equal(subjectTime.totalMinutes, 45);
  assert.deepEqual(subjectTime.slices.map(slice => slice.subject), ['數學', '國文']);
});

test('all overview blocks derive from the same requested period', () => {
  const period = summaryPeriod('2026-09-17', 'week');
  const summary = summarizeLearningPeriod([
    record('2026-09-14', [item('math', true, '20', '數學')], '06:30'),
    record('2026-09-15', [item('english', false, '40', '英文')], '07:00'),
    record('2026-09-22', [item('outside', true, '100', '自然')], '05:00'),
  ], period);

  assert.equal(summary.records.length, 2);
  assert.equal(summary.subjectTime.totalMinutes, 20);
  assert.equal(summary.averageWakeMinutes, 405);
  assert.equal(formatClockMinutes(summary.averageWakeMinutes), '06:45');
  assert.equal(summary.days.length, 7);
});

test('completed time deduplicates deferred copies and item drilldown totals', () => {
  const deferredOriginal = item('origin', true, '30', '英文');
  deferredOriginal.deferred = true;
  deferredOriginal.deferredTargetDay = 3;
  const carried = item('carry-a', true, '30', '英文');
  carried.deferredCarry = true;
  carried.deferredOriginId = 'origin';
  carried.title = '英文閱讀';
  const duplicate = { ...carried, id: 'carry-b' };
  const entries = completedStudyTimeEntries([
    record('2026-09-15', [deferredOriginal]),
    record('2026-09-16', [carried, duplicate]),
  ]);

  assert.equal(entries.length, 1);
  assert.equal(entries[0].minutes, 30);
  const detail = summarizeStudyItemTime(entries, '英文');
  assert.equal(detail.totalMinutes, 30);
  assert.equal(detail.slices.reduce((sum, slice) => sum + slice.percent, 0), 100);
});

test('subject drilldown omits repeated subject names and separates lecture versions', () => {
  const entries = completedStudyTimeEntries([record('2026-09-16', [
    { id: 'math-teaching', type: 'mathStudy', done: true, minutes: '20', required: true, f: { material: '教學講義', book: '2' } },
    { id: 'math-key', type: 'mathStudy', done: true, minutes: '25', required: true, f: { material: '新關鍵', book: '1~2' } },
    { id: 'english-reading', type: 'englishPractice', title: '英文閱讀', done: true, minutes: '15', required: true, f: { subject: '英文' } },
  ])]);

  assert.deepEqual(
    entries.filter(entry => entry.subject === '數學').map(entry => entry.itemLabel).sort(),
    ['教學講義 2冊｜進度', '新關鍵 1~2冊｜進度'].sort(),
  );
  assert.equal(entries.find(entry => entry.subject === '英文')?.itemLabel, '閱讀');
  assert.ok(entries.every(entry => !entry.itemLabel.startsWith(entry.subject)));
});

test('fixed remarks are deterministic and use the requested five-percent thresholds', () => {
  const stable = fixedPeriodRemarks(104, 100, 74, 70);
  assert.equal(stable.timeState, 'stable');
  assert.equal(stable.completionState, 'stable');
  assert.equal(stable.time, '本期學習時數大致穩定，可以繼續觀察目前安排是否適合。');
  assert.equal(stable.completion, '本期完成率大致穩定，可繼續維持並觀察較常卡住的項目。');

  const increase = fixedPeriodRemarks(105, 100, 75, 70);
  assert.equal(increase.timeState, 'increase');
  assert.equal(increase.completionState, 'increase');
  assert.equal(increase.time, '本期學習時數增加，建議維持目前節奏，同時留意休息與負荷。');
  assert.equal(increase.completion, '本期完成率提升，可以觀察哪些安排有助於任務順利完成。');

  const decrease = fixedPeriodRemarks(94.9, 100, 64.9, 70);
  assert.equal(decrease.timeState, 'decrease');
  assert.equal(decrease.completionState, 'decrease');
  assert.equal(decrease.time, '本期學習時數下降，可回顧近期狀態與排程，確認是否需要調整。');
  assert.equal(decrease.completion, '本期完成率下降，可檢查是否有任務過多、延期集中或安排不適合的情況。');
});

test('summary page has one global week/month switch and no separate total-hours card', () => {
  const html = readFileSync(new URL('../summary.html', import.meta.url), 'utf8');
  const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const config = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
  assert.equal((html.match(/id="summaryModeSwitch"/g) || []).length, 1);
  assert.equal((html.match(/data-summary-mode=/g) || []).length, 2);
  assert.doesNotMatch(html, /summary-heading-icon/);
  assert.doesNotMatch(html, /總時數/);
  assert.match(html, /圓內深淺＝當日學習時數/);
  assert.match(html, /深綠完整圓環＝100% 完成/);
  assert.match(html, /id="subjectBack"/);
  const runtime = readFileSync(new URL('../src/learning-summary-page.ts', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/learning-summary.css', import.meta.url), 'utf8');
  assert.doesNotMatch(runtime, /fetch\(|openai|anthropic|gemini/i);
  assert.match(styles, /background:rgba\(82,139,208,var\(--day-intensity\)\)/);
  assert.match(styles, /\.summary-day\.is-complete\{--day-accent:#256b49\}/);
  assert.match(index, /href="\.\/summary\.html">學習總結<\/a>/);
  assert.match(config, /learningSummary:\s*'\.\/summary\.html'/);
});
