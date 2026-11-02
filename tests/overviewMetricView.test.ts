import assert from 'node:assert/strict';
import test from 'node:test';
import { adjacentOverviewMetric, normalizeOverviewMetric, overviewMetricIndex } from '../src/ui/overviewMetricView.ts';

test('normalizes the shared pages/completion view', () => {
  assert.equal(normalizeOverviewMetric('pages'), 'pages');
  assert.equal(normalizeOverviewMetric('completion'), 'completion');
  assert.equal(normalizeOverviewMetric('unknown'), 'pages');
});
test('returns the correct position of each shared metric', () => {
  assert.equal(overviewMetricIndex('pages'), 0);
  assert.equal(overviewMetricIndex('completion'), 1);
});
test('keyboard navigation wraps between pages and completion in either direction', () => {
  assert.equal(adjacentOverviewMetric('pages', 1), 'completion');
  assert.equal(adjacentOverviewMetric('completion', 1), 'pages');
  assert.equal(adjacentOverviewMetric('pages', -1), 'completion');
});
