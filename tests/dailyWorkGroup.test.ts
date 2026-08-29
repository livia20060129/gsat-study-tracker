import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyDailyWorkRangeOverrides,
  groupDailyWorkItems,
  propagateDailyWorkDeferred,
  propagateDailyWorkDone,
  propagateDailyWorkMinutes,
  propagateDailyWorkRangeField,
  ungroupDailyWorkItems,
} from '../src/study/dailyWorkGroup.ts';
import type { StudyItem } from '../src/types.ts';

function math(id: string, start: number, end: number, deferredCarry = false): StudyItem {
  return {
    id,
    type: 'mathStudy',
    done: false,
    minutes: '',
    required: !deferredCarry,
    source: 'preset',
    presetKey: id,
    title: '數學講義：進度',
    description: deferredCarry ? '延期補做' : 'Google Calendar 當日排程',
    deferredCarry,
    f: { material: '教學講義', book: '1', start: String(start), end: String(end) },
  };
}

function round(id: string, value: number, deferredCarry = false): StudyItem {
  return {
    id,
    type: 'chineseReading',
    done: false,
    minutes: '',
    required: !deferredCarry,
    source: 'preset',
    presetKey: id,
    title: `國文｜古今悅讀一百 第 ${value} 回`,
    description: deferredCarry ? '延期補做' : 'Google Calendar 當日排程',
    deferredCarry,
    f: { kind: 'reading', round: String(value) },
  };
}

function mathPractice(id: string, start?: number, end?: number, deferredCarry = false): StudyItem {
  return {
    id,
    type: 'mathPractice',
    done: false,
    minutes: '',
    required: !deferredCarry,
    source: 'preset',
    presetKey: id,
    title: '數學講義題目：理解檢查＋錯題標記＋訂正',
    description: deferredCarry ? '延期補做' : '星期日原訂項目',
    deferredCarry,
    f: start && end
      ? { material: '教學講義', book: '1', start: String(start), end: String(end) }
      : {},
  };
}

test('merges the actual daily mix of Calendar and deferred math into one range', () => {
  const sources = [math('current', 158, 165), math('makeup-a', 149, 165, true), math('makeup-b', 166, 173, true)];
  const output = groupDailyWorkItems(sources);
  assert.equal(output.length, 1);
  assert.equal(output[0].f.start, '149');
  assert.equal(output[0].f.end, '173');
  assert.equal(output[0].required, true);
  assert.equal(output[0].deferredCarry, false);
  assert.equal((output[0].f.dailyWorkSourceItems as StudyItem[]).length, 3);
  assert.deepEqual(ungroupDailyWorkItems(output).map(item => item.id).sort(), ['current', 'makeup-a', 'makeup-b'].sort());
});

test('groups different rounds across Calendar and Tracker deferral sources', () => {
  const output = groupDailyWorkItems([round('current-14', 14), round('makeup-11', 11, true)]);
  assert.equal(output.length, 1);
  const children = output[0].f.groupedWorkEntries as StudyItem[];
  assert.deepEqual(children.map(child => child.f.round), ['14', '11']);
  assert.deepEqual(children.map(child => child.required), [true, false]);
});

test('keeps interrupted ranges as separate counted children in one card', () => {
  const output = groupDailyWorkItems([math('first', 1, 5), math('second', 11, 15, true)]);
  assert.equal(output.length, 1);
  const children = output[0].f.groupedWorkEntries as StudyItem[];
  assert.deepEqual(children.map(child => [child.f.start, child.f.end]), [['1', '5'], ['11', '15']]);
});

test('propagates a merged checkbox back to every hidden source record', () => {
  const output = groupDailyWorkItems([math('current', 1, 5), math('makeup', 6, 10, true)]);
  propagateDailyWorkDone(output[0], true);
  const sources = output[0].f.dailyWorkSourceItems as StudyItem[];
  assert.equal(output[0].done, true);
  assert.equal(sources.every(item => item.done), true);
});

test('groups the blank Sunday math-practice template with deferred page ranges', () => {
  const sources = [
    mathPractice('sunday-original'),
    mathPractice('makeup-a', 149, 157, true),
    mathPractice('makeup-b', 158, 165, true),
  ];
  const output = groupDailyWorkItems(sources);
  assert.equal(output.length, 1);
  const children = output[0].f.groupedWorkEntries as StudyItem[];
  assert.equal(children.length, 2);
  assert.equal(children[0].f.dailyWorkBlankTemplate, true);
  assert.deepEqual(children.map(child => child.required), [true, false]);
  assert.deepEqual([children[1].f.start, children[1].f.end], ['149', '165']);
});

test('groups math-practice across preset, Calendar, and deferred title variants', () => {
  const original = mathPractice('sunday-original');
  const calendar = mathPractice('calendar-range', 149, 157);
  calendar.source = 'calendar';
  calendar.title = '數學講義題目｜理解檢查＋錯題標記＋訂正';
  calendar.f.calendarFixedTemplate = 'mathPractice';
  const deferred = mathPractice('deferred-range', 158, 165, true);
  deferred.title = '數學講義題目｜理解檢查+錯題標記+訂正';

  const output = groupDailyWorkItems([original, calendar, deferred]);

  assert.equal(output.length, 1);
  const children = output[0].f.groupedWorkEntries as StudyItem[];
  assert.equal(children.length, 2);
  assert.equal(children[0].f.dailyWorkBlankTemplate, true);
  assert.deepEqual([children[1].f.start, children[1].f.end], ['149', '165']);
  assert.deepEqual(
    (children[1].f.dailyWorkSourceItems as StudyItem[]).map(item => item.id).sort(),
    ['calendar-range', 'deferred-range'],
  );
});

test('preserves a Sunday grouped child checkbox after rebuilding the daily card', () => {
  const output = groupDailyWorkItems([
    mathPractice('sunday-original'),
    mathPractice('makeup', 149, 157, true),
  ]);
  const children = output[0].f.groupedWorkEntries as StudyItem[];
  propagateDailyWorkDone(children[1], true);
  const rebuilt = groupDailyWorkItems(ungroupDailyWorkItems(output));
  const rebuiltChildren = rebuilt[0].f.groupedWorkEntries as StudyItem[];
  assert.equal(rebuiltChildren[1].done, true);
});

test('stores merged math-study minutes on the preferred source used after rebuilding', () => {
  const output = groupDailyWorkItems([
    math('current', 158, 165),
    math('earlier-makeup', 149, 157, true),
  ]);
  assert.deepEqual(
    (output[0].f.dailyWorkSourceItems as StudyItem[]).map(item => item.id),
    ['earlier-makeup', 'current'],
  );
  propagateDailyWorkMinutes(output[0], '45');
  const rebuilt = groupDailyWorkItems(ungroupDailyWorkItems(output));
  assert.equal(rebuilt[0].minutes, '45');
});

test('stores an edited merged end page on the source that owns the upper boundary', () => {
  const output = groupDailyWorkItems([
    math('current', 158, 165),
    math('earlier-makeup', 149, 157, true),
  ]);
  propagateDailyWorkRangeField(output[0], 'end', '170');
  const sources = ungroupDailyWorkItems(output);
  assert.equal(sources.find(item => item.id === 'current')?.f.end, '170');
  assert.equal(sources.find(item => item.id === 'earlier-makeup')?.f.end, '157');

  const rebuilt = groupDailyWorkItems(sources);
  assert.equal(rebuilt[0].f.start, '149');
  assert.equal(rebuilt[0].f.end, '170');
});

test('stores an edited merged start page on the source that owns the lower boundary', () => {
  const output = groupDailyWorkItems([
    math('current', 158, 165),
    math('earlier-makeup', 149, 157, true),
  ]);
  propagateDailyWorkRangeField(output[0], 'start', '145');
  const sources = ungroupDailyWorkItems(output);
  assert.equal(sources.find(item => item.id === 'current')?.f.start, '158');
  assert.equal(sources.find(item => item.id === 'earlier-makeup')?.f.start, '145');
  assert.equal(groupDailyWorkItems(sources)[0].f.start, '145');
});

test('restores an explicit range edit after Calendar refreshes its suggested pages', () => {
  const item = math('calendar', 158, 165);
  propagateDailyWorkRangeField(item, 'end', '170');
  item.f.end = '165';
  applyDailyWorkRangeOverrides(item);
  assert.equal(item.f.end, '170');
});

test('preserves an independently deferred grouped child after rebuilding', () => {
  const output = groupDailyWorkItems([
    mathPractice('original'),
    mathPractice('scoped', 149, 157),
  ]);
  const child = (output[0].f.groupedWorkEntries as StudyItem[])[1];
  propagateDailyWorkDeferred(child, true, 6);
  const rebuilt = groupDailyWorkItems(ungroupDailyWorkItems(output));
  const rebuiltChild = (rebuilt[0].f.groupedWorkEntries as StudyItem[])[1];
  assert.equal(rebuiltChild.deferred, true);
  assert.equal(rebuiltChild.deferredTargetDay, 6);
  assert.equal(rebuiltChild.done, false);
});
