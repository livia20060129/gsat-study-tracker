import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateMathProgress,
  extractCompletedMathPages,
  MathProgressIndex,
} from '../src/study/mathProgress.ts';
import type { StudyItem, StudyRecord } from '../src/types.ts';

function math(id: string, start: number, end: number, done = true): StudyItem {
  return {
    id,
    type: 'mathStudy',
    done,
    minutes: '',
    required: true,
    source: 'preset',
    title: '數學講義：進度',
    f: { material: '教學講義', book: '1', start: String(start), end: String(end) },
  };
}

function mathLecture(id: string, start: number, end: number): StudyItem {
  return {
    ...math(id, start, end),
    type: 'mathLecture',
    title: '數學講義：理解檢查＋錯題標記＋訂正',
    f: {
      material: '教學講義',
      book: '1',
      start: String(start),
      end: String(end),
      progress: true,
    },
  };
}

function pageCount(items: StudyItem[]): number {
  const record: StudyRecord = { date: '2026-08-29', items };
  return [...extractCompletedMathPages(record).values()]
    .reduce((total, pages) => total + pages.size, 0);
}

test('已完成的合併子卡片會列入數學頁數並排除重疊頁碼', () => {
  const first = math('calendar-current', 158, 163);
  const deferred = { ...math('tracker-deferred', 149, 165), deferredCarry: true };
  const parent = math('grouped-parent', 158, 163);
  parent.f.groupedWorkEntries = [first, deferred];
  parent.done = true;

  assert.equal(pageCount([parent]), 17);
});

test('群組內未完成的 Calendar／延期子卡片不會提前列入頁數', () => {
  const completed = math('calendar-current', 158, 163);
  const pending = { ...math('tracker-deferred', 149, 165, false), deferredCarry: true };
  const parent = math('grouped-parent', 158, 163, false);
  parent.f.groupedWorkEntries = [completed, pending];

  assert.equal(pageCount([parent]), 6);
});

test('沒有子卡片的合併連續範圍仍以大卡片範圍計算', () => {
  assert.equal(pageCount([math('merged-range', 149, 165)]), 17);
});

test('外出日已完成的數學講義仍會列入頁數進度', () => {
  const record: StudyRecord = {
    date: '2026-08-29',
    mood: '外出',
    items: [mathLecture('away-day-completed', 16, 18)],
  };

  const pages = [...extractCompletedMathPages(record).values()]
    .reduce((total, range) => total + range.size, 0);

  assert.equal(pages, 3);

  const index = new MathProgressIndex();
  index.upsert(record);
  const summary = calculateMathProgress(index.view(), record.date, 30);
  assert.equal(summary.dailyNewPages, 3);
  assert.equal(summary.weeklyNewPages, 3);
});
