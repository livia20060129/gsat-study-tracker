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

test('keeps weekly and additional same-template Calendar events separate', () => {
  const builtIn = definition('fri_mock_timed', '英文歷屆／模考：限時作答');
  const first = definition('cal_fixed_englishMockTimed_event-1', '英文歷屆／模考：限時作答', {
    calendarFixedTemplate: 'englishMockTimed',
    calendarRoute: 'today',
  });
  const second = definition('cal_fixed_englishMockTimed_event-2', '英文歷屆／模考：限時作答', {
    calendarFixedTemplate: 'englishMockTimed',
    calendarRoute: 'today',
  });
  const weekly = definition('cal_fixed_englishMockTimed_event-3', '英文歷屆／模考：限時作答', {
    calendarFixedTemplate: 'englishMockTimed',
    calendarRoute: 'week',
  });
  const output = dedupePresetDefinitions([builtIn, first, second, weekly]);

  assert.equal(output.length, 3);
  assert.equal(output[0].f.calendarMerged, true);
  assert.equal(output[1].key, second.key);
  assert.equal(output[2].key, weekly.key);
});
