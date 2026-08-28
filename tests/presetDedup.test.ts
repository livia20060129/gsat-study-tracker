import assert from 'node:assert/strict';
import test from 'node:test';

import { dedupePresetDefinitions, type PresetDefinitionLike } from '../src/study/presetDedup.ts';

function definition(
  key: string,
  title: string,
  fields: Record<string, unknown> = {},
): PresetDefinitionLike {
  return { key, type: 'mock', title, description: '說明', required: true, f: fields };
}

test('merges a matching Calendar mock into the built-in card', () => {
  const output = dedupePresetDefinitions([
    definition('fri_mock_timed', '英文歷屆／模考：限時作答', { subject: '英文' }),
    definition('cal_fixed_englishMockTimed_event-1', '英文歷屆／模考：限時作答', {
      calendarFixedTemplate: 'englishMockTimed',
      calendarEventId: 'event-1',
      calendarRoute: 'today',
    }),
  ]);

  assert.equal(output.length, 1);
  assert.equal(output[0].key, 'fri_mock_timed');
  assert.equal(output[0].f.calendarMerged, true);
  assert.equal(output[0].f.calendarEventId, 'event-1');
});

test('merges Calendar magazine makeup and preserves its extra workload marker', () => {
  const output = dedupePresetDefinitions([
    definition('fri_magazine', '學測英文訓練：英文雜誌'),
    definition('cal_fixed_fixedMagazine_event-2', '學測英文訓練：英文雜誌', {
      calendarFixedTemplate: 'fixedMagazine',
      calendarEventId: 'event-2',
      calendarRoute: 'today',
      calendarMakeup: true,
    }),
  ]);

  assert.equal(output.length, 1);
  assert.equal(output[0].key, 'fri_magazine');
  assert.equal(output[0].f.calendarMerged, true);
  assert.equal(output[0].f.calendarIncludesMakeup, true);
  assert.equal('calendarMakeup' in output[0].f, false);
});

test('collapses duplicate Calendar events that schedule the same work', () => {
  const builtIn = definition('fri_mock_timed', '英文歷屆／模考：限時作答');
  const first = definition('cal_fixed_englishMockTimed_event-1', '英文歷屆／模考：限時作答', {
    calendarFixedTemplate: 'englishMockTimed',
    calendarEventId: 'event-1',
    calendarRoute: 'today',
  });
  const second = definition('cal_fixed_englishMockTimed_event-2', '英文歷屆／模考：限時作答', {
    calendarFixedTemplate: 'englishMockTimed',
    calendarEventId: 'event-2',
    calendarRoute: 'today',
  });
  const weekly = definition('cal_fixed_englishMockTimed_event-3', '英文歷屆／模考：限時作答', {
    calendarFixedTemplate: 'englishMockTimed',
    calendarRoute: 'week',
  });
  const output = dedupePresetDefinitions([builtIn, first, second, weekly]);

  assert.equal(output.length, 2);
  assert.equal(output[0].f.calendarMerged, true);
  assert.equal(output[1].key, weekly.key);
});

test('keeps same-template Calendar work separate when its range differs', () => {
  const first = definition('cal_essential_grammar_12_event-1', '英文｜Essential Grammar in Use｜Unit 12', {
    title: 'Essential Grammar in Use', unit: '12', unitStart: '12', unitEnd: '12', calendarRoute: 'today',
  });
  const second = definition('cal_essential_grammar_13_event-2', '英文｜Essential Grammar in Use｜Unit 13', {
    title: 'Essential Grammar in Use', unit: '13', unitStart: '13', unitEnd: '13', calendarRoute: 'today',
  });

  const output = dedupePresetDefinitions([first, second]);
  assert.equal(output.length, 2);
});

test('merges adjacent Calendar page ranges into one normal item', () => {
  const ranges = [[1, 5], [6, 10], [11, 15]].map(([start, end], index) => definition(
    `cal_fixed_mathStudy_event-${index}`,
    '數學講義：進度',
    {
      calendarFixedTemplate: 'mathStudy', calendarRoute: 'today',
      calendarEventKey: `event-${index}`, material: '教學講義',
      start: String(start), end: String(end),
    },
  ));

  const output = dedupePresetDefinitions(ranges);
  assert.equal(output.length, 1);
  assert.equal(output[0].f.start, '1');
  assert.equal(output[0].f.end, '15');
  assert.equal(output[0].f.groupedWorkEntries, undefined);
  assert.deepEqual(output[0].f.calendarEventKeys, ['event-0', 'event-1', 'event-2']);
});

test('groups interrupted Calendar page ranges as separately countable children', () => {
  const output = dedupePresetDefinitions([
    definition('cal_fixed_mathStudy_event-1', '數學講義：進度', {
      calendarFixedTemplate: 'mathStudy', calendarRoute: 'today', calendarEventKey: 'event-1',
      material: '教學講義', start: '1', end: '5',
    }),
    definition('cal_fixed_mathStudy_event-2', '數學講義：進度', {
      calendarFixedTemplate: 'mathStudy', calendarRoute: 'today', calendarEventKey: 'event-2',
      material: '教學講義', start: '11', end: '15',
    }),
  ]);

  assert.equal(output.length, 1);
  assert.equal(output[0].f.calendarGroupedWork, true);
  const children = output[0].f.groupedWorkEntries as Array<{ f: Record<string, unknown> }>;
  assert.equal(children.length, 2);
  assert.deepEqual(children.map(child => [child.f.start, child.f.end]), [['1', '5'], ['11', '15']]);
});

test('groups repeated Calendar rounds into one parent with separate children', () => {
  const output = dedupePresetDefinitions([
    { ...definition('cal_ace_1_event-1', '英文｜ACE Reading 第 1 回', { title: 'ACE Reading', round: '1', calendarRoute: 'today', calendarEventKey: 'event-1' }), type: 'extra' },
    { ...definition('cal_ace_2_event-2', '英文｜ACE Reading 第 2 回', { title: 'ACE Reading', round: '2', calendarRoute: 'today', calendarEventKey: 'event-2' }), type: 'extra' },
  ]);

  assert.equal(output.length, 1);
  assert.equal(output[0].title, '英文｜ACE Reading');
  const children = output[0].f.groupedWorkEntries as Array<{ f: Record<string, unknown> }>;
  assert.deepEqual(children.map(child => child.f.round), ['1', '2']);
});
