import assert from 'node:assert/strict';
import test from 'node:test';

import { parseCalendarTask, type CalendarTaskRow } from '../src/calendar/calendarBridge.ts';

function row(title: string, description = '', category = 'other'): CalendarTaskRow {
  return {
    event_key: 'primary:event-1',
    source_event_id: 'event-1',
    calendar_id: 'primary',
    event_date: '2026-08-31',
    title,
    description,
    category,
  };
}

test('parses an Essential Grammar unit range into individual units', () => {
  const parsed = parseCalendarTask(row('Essential Grammar in Use｜Unit 12–14'));
  assert.equal(parsed.kind, 'essentialGrammar');
  if (parsed.kind === 'essentialGrammar') assert.deepEqual(parsed.units, [12, 13, 14]);
});

test('parses separate Essential Grammar units from the description', () => {
  const parsed = parseCalendarTask(row('Essential Grammar in Use', 'Unit：1、3、5'));
  assert.equal(parsed.kind, 'essentialGrammar');
  if (parsed.kind === 'essentialGrammar') assert.deepEqual(parsed.units, [1, 3, 5]);
});

test('does not create Essential Grammar units beyond Unit 115', () => {
  const parsed = parseCalendarTask(row('Essential Grammar in Use｜Unit 114–118'));
  assert.equal(parsed.kind, 'essentialGrammar');
  if (parsed.kind === 'essentialGrammar') assert.deepEqual(parsed.units, [114, 115]);
});

test('routes prefixed Calendar items to today or this week', () => {
  const today = parseCalendarTask(row('今日項目｜英文單字複習'));
  const week = parseCalendarTask(row('本週項目｜整理自然錯題'));
  assert.equal(today.kind, 'calendarItem');
  assert.equal(today.route, 'today');
  assert.equal(today.title, '英文單字複習');
  assert.equal(week.kind, 'calendarItem');
  assert.equal(week.route, 'week');
  assert.equal(week.title, '整理自然錯題');
});

test('routes unprefixed Calendar items to today', () => {
  const generic = parseCalendarTask(row('整理化學錯題'));
  const essentialGrammar = parseCalendarTask(row('Essential Grammar in Use｜Unit 20'));
  assert.equal(generic.kind, 'calendarItem');
  assert.equal(generic.route, 'today');
  assert.equal(essentialGrammar.route, 'today');
});

test('routes Essential Grammar to this week only with the weekly prefix', () => {
  const weekly = parseCalendarTask(row('本週項目｜Essential Grammar in Use｜Unit 21'));
  assert.equal(weekly.kind, 'essentialGrammar');
  assert.equal(weekly.route, 'week');
});
