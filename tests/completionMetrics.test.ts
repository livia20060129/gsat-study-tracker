import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatPercentagePointDelta,
  summarizeCompletionUnits,
} from '../src/study/completionMetrics.ts';

test('keeps accepted items separate from actually completed workload', () => {
  const metrics = summarizeCompletionUnits([
    { itemAccepted: true, workloadCompleted: true, workload: 60 },
    { itemAccepted: true, workloadCompleted: false, workload: 40 },
  ]);

  assert.equal(metrics.itemPercent, 100);
  assert.equal(metrics.workloadPercent, 60);
  assert.equal(metrics.settlementPercent, 80);
});

test('weights heavier planned work without changing item counts', () => {
  const metrics = summarizeCompletionUnits([
    { itemAccepted: true, workloadCompleted: true, workload: 30 },
    { itemAccepted: false, workloadCompleted: false, workload: 90 },
  ]);

  assert.equal(metrics.itemPercent, 50);
  assert.equal(metrics.workloadPercent, 25);
  assert.equal(metrics.settlementPercent, 38);
});

test('formats Friday comparison as signed percentage points', () => {
  assert.equal(formatPercentagePointDelta(8), '+8%');
  assert.equal(formatPercentagePointDelta(-8), '-8%');
  assert.equal(formatPercentagePointDelta(0), '±0%');
});
