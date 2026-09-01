import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCalendarStudyTaskPlan,
  createCalendarStudyTask,
} from '../src/application/calendar/calendarStudyTaskService.ts';

const baseRow = {
  source_event_id: 'event-1',
  calendar_id: 'primary',
  event_date: '2026-09-05',
  description: '',
  category: 'other',
};

test('application service turns a Calendar row into a Tracker task', () => {
  const task = createCalendarStudyTask({
    ...baseRow,
    event_key: 'primary:event-1:2026-09-05',
    title: '今日項目｜複習英文單字',
  });
  assert.equal(task?.origin, 'google-calendar');
  assert.equal(task?.route, 'today');
  assert.equal(task?.kind, 'calendarItem');
  assert.equal(task?.taskId, 'google-calendar:primary:event-1:2026-09-05');
});

test('Calendar makeup is normalized to today by the application service', () => {
  const task = createCalendarStudyTask({
    ...baseRow,
    event_key: 'makeup-event',
    title: '本週項目｜補做｜英文訂正與搭配詞整理',
  });
  assert.equal(task?.makeup, true);
  assert.equal(task?.route, 'today');
  assert.equal(task?.kind, 'fixedTemplate');
});

test('application service builds a date index for legacy and future presenters', () => {
  const plan = buildCalendarStudyTaskPlan([
    { ...baseRow, event_key: 'one', title: '項目一' },
    { ...baseRow, event_key: 'two', title: '本週項目｜項目二' },
  ]);
  assert.equal(plan.tasks.length, 2);
  assert.equal(plan.byDate['2026-09-05']?.length, 2);
  assert.deepEqual(plan.tasks.map(task => task.route), ['today', 'week']);
});
