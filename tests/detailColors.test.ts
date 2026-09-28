import assert from 'node:assert/strict';
import test from 'node:test';

import { sameHueDetailColor } from '../src/study/detailColors.ts';
import { SUBJECT_TIME_COLORS } from '../src/study/subjectTime.ts';

function brightness(hex: string): number {
  const value = hex.replace('#', '');
  return [0, 2, 4]
    .map(index => Number.parseInt(value.slice(index, index + 2), 16))
    .reduce((sum, channel) => sum + channel, 0) / 3;
}

test('every subject palette keeps one hue family with clearly separated item tones', () => {
  Object.entries(SUBJECT_TIME_COLORS).forEach(([subject, baseColor]) => {
    const colors = Array.from({ length: 6 }, (_, index) => sameHueDetailColor(baseColor, index, 6));
    assert.equal(new Set(colors).size, 6, subject);
    const brightnessValues = colors.map(brightness);
    assert.ok(Math.max(...brightnessValues) - Math.min(...brightnessValues) > 80, subject);
  });
});

test('a single item keeps the exact subject color', () => {
  Object.values(SUBJECT_TIME_COLORS).forEach(baseColor => {
    assert.equal(sameHueDetailColor(baseColor, 0, 1), baseColor);
  });
});
