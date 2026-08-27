import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cloneOriginalItemForMakeup,
  effectiveTemplatePresetKey,
  mergeMakeupProgress,
  specialItemTemplate,
} from '../src/study/makeup.ts';
import type { StudyItem, StudyItemType } from '../src/types.ts';

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

test('keeps every supported deferred item type and its complete field payload', () => {
  const types: StudyItemType[] = [
    'mathStudy', 'mathLecture', 'mathPractice', 'mathOral', 'magazine',
    'englishPractice', 'englishVocabInteractive', 'englishMixedWriting',
    'biologyInteractive', 'scienceReview', 'chineseReading', 'mock', 'general',
    'extra', 'interactive', 'interactiveDaily', 'calendarStudy',
  ];

  for (const type of types) {
    const original: StudyItem = {
      id: `original-${type}`,
      type,
      done: false,
      minutes: '',
      required: true,
      source: 'preset',
      presetKey: `template-${type}`,
      title: `template title ${type}`,
      description: `template description ${type}`,
      deferred: true,
      deferredTargetDay: 6,
      f: { marker: type, nested: { retained: true } },
    };
    const makeup = cloneOriginalItemForMakeup(original, {
      id: `makeup-${type}`,
      presetKey: `deferred-${type}`,
      originDate: '2026-08-27',
    });

    assert.equal(makeup.type, type);
    assert.equal(makeup.title, original.title);
    assert.equal(makeup.f.marker, type);
    assert.deepEqual(makeup.f.nested, { retained: true });
    assert.equal(makeup.templatePresetKey, original.presetKey);
  }
});

test('preserves the three special templates after defer', () => {
  const cases: Array<[StudyItem, string]> = [
    [{ ...originalItem(), type: 'general', presetKey: 'weekday_english_review', title: '英文訂正與搭配詞整理', f: { words: [] } }, 'englishReview'],
    [{ ...originalItem(), type: 'interactiveDaily', presetKey: 'daily_interactive', title: '互動題', f: { interactiveEntries: [] } }, 'interactiveDaily'],
    [{ ...originalItem(), type: 'magazine', presetKey: 'weekday_magazine', title: '學測英文訓練：英文雜誌', f: { entries: [] } }, 'fixedMagazine'],
  ];

  for (const [original, expectedTemplate] of cases) {
    const makeup = cloneOriginalItemForMakeup(original, {
      id: `makeup-${original.presetKey}`,
      presetKey: `deferred-${original.presetKey}`,
      originDate: '2026-08-27',
    });
    assert.equal(specialItemTemplate(makeup), expectedTemplate);
    assert.deepEqual(makeup.f, original.f);
  }
});
