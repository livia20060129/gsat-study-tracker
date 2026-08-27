import assert from 'node:assert/strict';
import test from 'node:test';

import { cloneOriginalItemForMakeup, effectiveTemplatePresetKey, mergeMakeupProgress } from '../src/study/makeup.ts';
import type { StudyItem } from '../src/types.ts';

function originalItem(): StudyItem {
  return {
    id: 'preset-2026-08-27-cal-essential',
    type: 'extra',
    done: false,
    minutes: '25',
    required: true,
    source: 'preset',
    presetKey: 'cal_essential_grammar_21_event',
    title: '英文｜Essential Grammar in Use｜Unit 21',
    description: 'Calendar 指定 Unit',
    deferred: true,
    deferredTargetDay: 5,
    f: {
      title: 'Essential Grammar in Use',
      unit: '21',
      unitStart: '21',
      unitEnd: '21',
      calendarRoute: 'today',
    },
  };
}

test('clones a deferred item with its full original template and values', () => {
  const original = originalItem();
  const makeup = cloneOriginalItemForMakeup(original, {
    id: 'preset-2026-08-28-deferred-item',
    presetKey: 'deferred_20260827_item',
    originDate: '2026-08-27',
  });

  assert.equal(makeup.type, 'extra');
  assert.equal(makeup.title, original.title);
  assert.deepEqual(makeup.f, original.f);
  assert.notEqual(makeup.f, original.f);
  assert.equal(makeup.templatePresetKey, original.presetKey);
  assert.equal(effectiveTemplatePresetKey(makeup), original.presetKey);
  assert.equal(makeup.done, false);
  assert.equal(makeup.deferred, false);
  assert.equal(makeup.deferredTargetDay, undefined);
  assert.equal(original.deferred, true);
});

test('restores missing template fields without losing entered makeup progress', () => {
  const template = cloneOriginalItemForMakeup(originalItem(), {
    id: 'makeup',
    presetKey: 'deferred_item',
    originDate: '2026-08-27',
  });
  const existing: StudyItem = {
    ...template,
    done: true,
    minutes: '35',
    f: { corrected: true },
  };

  const merged = mergeMakeupProgress(template, existing);
  assert.equal(merged.done, true);
  assert.equal(merged.minutes, '35');
  assert.equal(merged.f.title, 'Essential Grammar in Use');
  assert.equal(merged.f.unit, '21');
  assert.equal(merged.f.corrected, true);
});
