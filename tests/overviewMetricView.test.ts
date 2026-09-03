import assert from 'node:assert/strict';
import test from 'node:test';

import {
  adjacentOverviewMetric,
  normalizeOverviewMetric,
  overviewMetricIndex,
} from '../src/ui/overviewMetricView.ts';

test('normalizes the three overview metric segments', () => {
  assert.equal(normalizeOverviewMetric('minutes'), 'minutes');
  assert.equal(normalizeOverviewMetric('mathToday'), 'mathToday');
  assert.equal(normalizeOverviewMetric('mathWeek'), 'mathWeek');
  assert.equal(normalizeOverviewMetric('unknown'), 'minutes');
});

test('returns the correct slider position for every segment', () => {
  assert.equal(overviewMetricIndex('minutes'), 0);
  assert.equal(overviewMetricIndex('mathToday'), 1);
  assert.equal(overviewMetricIndex('mathWeek'), 2);
});

test('keyboard segment navigation wraps in both directions', () => {
  assert.equal(adjacentOverviewMetric('minutes', 1), 'mathToday');
  assert.equal(adjacentOverviewMetric('mathWeek', 1), 'minutes');
  assert.equal(adjacentOverviewMetric('minutes', -1), 'mathWeek');
});
