import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizedOverdueSubject,
  overdueSubjectIndex,
  overdueTasks,
  updateOverdueTaskCompletion,
  updateOverdueTaskMinutes,
  updateOverdueTaskSkip,
} from '../src/study/overdueTasks.ts';
import type { StudyItem, StudyRecord } from '../src/types.ts';

function item(overrides: Partial<StudyItem> = {}): StudyItem {
  return {
    id: 'scheduled-item',
    type: 'general',
    title: '排程項目',
    done: false,
    minutes: '',
    required: true,
    source: 'preset',
    f: {},
    ...overrides,
  };
}

function record(date: string, items: StudyItem[]): StudyRecord {
  return { date, items };
}

test('待辦只列出今天以前尚未完成、未延期且未跳過的正式排程', () => {
  const results = overdueTasks([
    record('2026-10-04', [
      item({ id: 'english', title: '英文閱讀', type: 'englishPractice', f: { subject: '英文' } }),
      item({ id: 'done', title: '已完成', done: true }),
      item({ id: 'deferred', title: '已延期', deferred: true, deferredTargetDay: 5 }),
      item({ id: 'deferred-carry', title: '延期補做', deferredCarry: true }),
      item({ id: 'skipped', title: '已跳過', f: { overdueSkippedOn: '2026-10-06' } }),
      item({ id: 'custom', title: '自行新增', source: 'custom' }),
    ]),
    record('2026-10-07', [item({ id: 'today', title: '今日項目' })]),
    record('2026-10-08', [item({ id: 'future', title: '未來項目' })]),
  ], '2026-10-07');

  assert.deepEqual(results.map(result => result.itemId), ['english']);
  assert.equal(results[0].subject, 'english');
  assert.equal(results[0].subjectLabel, '英文');
  assert.equal(results[0].daysOverdue, 3);
});

test('待辦帶出原紀錄卡的學習時間與已填欄位', () => {
  const results = overdueTasks([record('2026-10-04', [item({
    id: 'science',
    title: '化學複習',
    type: 'scienceReview',
    minutes: '18.5',
    f: {
      subject: '化學',
      material: '新關鍵',
      start: '40',
      end: '52',
      calendarTopic: '物質的構造',
      progress: true,
      corrected: false,
    },
  })])], '2026-10-07');

  assert.equal(results[0].minutes, '18.5');
  assert.deepEqual(results[0].details, [
    { label: '項目類型', value: '自然複習' },
    { label: '科目', value: '化學' },
    { label: '講義', value: '新關鍵' },
    { label: '起始頁', value: '40' },
    { label: '結束頁', value: '52' },
    { label: 'Google Calendar 當日主題', value: '物質的構造' },
    { label: '進度', value: '已勾選' },
    { label: '訂正', value: '未勾選' },
  ]);
});

test('合併卡片中的真實排程子項目各自出現在待辦且依科目分類', () => {
  const grouped = item({
    id: 'merged-card',
    required: false,
    source: 'summary',
    f: {
      dailyWorkSourceItems: [
        item({ id: 'math-child', title: '數學講義', type: 'mathStudy', f: { subject: '數學A' } }),
        item({ id: 'science-child', title: '物理複習', type: 'scienceReview', f: { subject: '物理' } }),
      ],
    },
  });

  const results = overdueTasks([record('2026-10-05', [grouped])], '2026-10-07');
  assert.deepEqual(
    results.map(result => [result.itemId, result.subject]).sort(),
    [['math-child', 'math'], ['science-child', 'natural']],
  );
});

test('跳過與復原會更新巢狀項目但不改動完成狀態或原紀錄', () => {
  const original = record('2026-10-05', [item({
    id: 'parent',
    source: 'summary',
    required: false,
    f: { groupedWorkEntries: [item({ id: 'child', title: '子項目' })] },
  })]);

  const skipped = updateOverdueTaskSkip(original, 'child', '2026-10-07');
  assert.ok(skipped);
  const skippedChild = skipped.items[0].f.groupedWorkEntries?.[0];
  assert.equal(skippedChild?.f.overdueSkippedOn, '2026-10-07');
  assert.equal(skippedChild?.done, false);
  assert.equal(original.items[0].f.groupedWorkEntries?.[0].f.overdueSkippedOn, undefined);

  const restored = updateOverdueTaskSkip(skipped, 'child', null);
  assert.ok(restored);
  assert.equal(restored.items[0].f.groupedWorkEntries?.[0].f.overdueSkippedOn, undefined);
  assert.equal(restored.items[0].f.groupedWorkEntries?.[0].done, false);
  assert.equal(updateOverdueTaskSkip(original, 'missing', '2026-10-07'), null);
});

test('待辦可直接保存分鐘並以實際完成日期更新原卡片', () => {
  const original = record('2026-10-05', [item({
    id: 'parent',
    source: 'summary',
    required: false,
    f: {
      groupedWorkEntries: [
        item({ id: 'finished-child', title: '已完成子項目', done: true }),
        item({ id: 'pending-child', title: '待辦子項目' }),
      ],
    },
  })]);

  const timed = updateOverdueTaskMinutes(original, 'pending-child', '25.5');
  assert.ok(timed);
  assert.equal(timed.items[0].f.groupedWorkEntries?.[1].minutes, '25.5');
  assert.equal(original.items[0].f.groupedWorkEntries?.[1].minutes, '');
  assert.equal(updateOverdueTaskMinutes(original, 'pending-child', '-1'), null);

  const completed = updateOverdueTaskCompletion(timed, 'pending-child', true, '2026-10-08');
  assert.ok(completed);
  assert.equal(completed.items[0].f.groupedWorkEntries?.[1].done, true);
  assert.equal(completed.items[0].f.groupedWorkEntries?.[1].checkedOn, '2026-10-08');
  assert.equal(completed.items[0].done, true);

  const restored = updateOverdueTaskCompletion(completed, 'pending-child', false, '2026-10-08');
  assert.ok(restored);
  assert.equal(restored.items[0].f.groupedWorkEntries?.[1].done, false);
  assert.equal(restored.items[0].f.groupedWorkEntries?.[1].checkedOn, undefined);
  assert.equal(restored.items[0].done, false);
  assert.equal(updateOverdueTaskCompletion(original, 'pending-child', true, 'not-a-date'), null);
});

test('待辦科目滑塊將無效網址值還原為全部', () => {
  assert.equal(normalizedOverdueSubject('natural'), 'natural');
  assert.equal(normalizedOverdueSubject('invalid'), 'all');
  assert.equal(overdueSubjectIndex('all'), 0);
  assert.equal(overdueSubjectIndex('other'), 5);
});
