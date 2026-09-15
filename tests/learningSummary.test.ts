import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  calendarLeadingBlankCount,
  completedSubjectTimeForRecord,
  formatClockMinutes,
  shiftSummaryAnchor,
  summarizeLearningPeriod,
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

test('summary page has one global week/month switch and no separate total-hours card', () => {
  const html = readFileSync(new URL('../summary.html', import.meta.url), 'utf8');
  const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const config = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
  assert.equal((html.match(/id="summaryModeSwitch"/g) || []).length, 1);
  assert.equal((html.match(/data-summary-mode=/g) || []).length, 2);
  assert.doesNotMatch(html, /總時數/);
  assert.doesNotMatch(html, /圖內顏色|外圈圓環|0%|25%|50%|75%|100%/);
  assert.match(index, /href="\.\/summary\.html">學習總結<\/a>/);
  assert.match(config, /learningSummary:\s*'\.\/summary\.html'/);
});

