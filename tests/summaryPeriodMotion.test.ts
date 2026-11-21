import assert from 'node:assert/strict';
import test from 'node:test';
import { interpolateSummaryClock, interpolateSummaryPoints } from '../src/ui/summaryPeriodMotion.ts';
import { formatClockMinutes } from '../src/study/sleep.ts';

test('different month lengths resample the previous curve while retaining both endpoints', () => {
  const from: [number, number][] = Array.from({ length: 31 }, (_, i) => [i * 10, 30 - i]);
  const to: [number, number][] = Array.from({ length: 28 }, (_, i) => [5 + i * 10, i * 2]);
  const start = interpolateSummaryPoints(from, to, 0);
  assert.equal(start.length, 28);
  assert.deepEqual(start[0], from[0]);
  assert.deepEqual(start.at(-1), from.at(-1));
  assert.deepEqual(interpolateSummaryPoints(from, to, 1), to);
  const middle = interpolateSummaryPoints(from, to, .5);
  assert.deepEqual(middle[0], [2.5, 15]);
  assert.deepEqual(middle.at(-1), [287.5, 27]);
  assert(middle.every(point => point.every(Number.isFinite)));
});

test('point interpolation handles empty and single-point curves without mutating either input', () => {
  const to: [number, number][] = [[1, 2], [3, 4]];
  assert.deepEqual(interpolateSummaryPoints([], to, .5), to);
  assert.deepEqual(interpolateSummaryPoints([[0, 0]], to, .5), [[.5, 1], [1.5, 2]]);
  assert.deepEqual(interpolateSummaryPoints(to, [], .5), []);
  assert.deepEqual(to, [[1, 2], [3, 4]]);
});

test('render timestamps before the animation start and after its end cannot overshoot', () => {
  const from: [number, number][] = [[0, 10], [20, 30]], to: [number, number][] = [[30, 0], [40, 0]];
  assert.deepEqual(interpolateSummaryPoints(from, to, -.1), from);
  assert.deepEqual(interpolateSummaryPoints(from, to, 1.1), to);
});

test('clock changes across midnight take the short path in either direction', () => {
  assert.equal(formatClockMinutes(interpolateSummaryClock(1430, 20, .5)), '00:05');
  assert.equal(formatClockMinutes(interpolateSummaryClock(20, 1430, .5)), '00:05');
  assert.equal(formatClockMinutes(interpolateSummaryClock(23 * 60, 60, .5)), '00:00');
});

test('a clock retargeted from its painted value keeps its path continuous', () => {
  const painted = interpolateSummaryClock(1430, 20, 2 / 3);
  assert.equal(formatClockMinutes(painted), '00:10');
  assert.equal(interpolateSummaryClock(painted, 1420, 0), painted);
  assert.equal(formatClockMinutes(interpolateSummaryClock(painted, 1420, .5)), '23:55');
  assert.equal(formatClockMinutes(interpolateSummaryClock(painted, 1420, 1)), '23:40');
  assert.equal(formatClockMinutes(interpolateSummaryClock(5750, 20, .5)), '00:05');
  assert.equal(formatClockMinutes(interpolateSummaryClock(-1450, 20, .5)), '00:05');
});
