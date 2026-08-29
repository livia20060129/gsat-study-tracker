import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatPercentagePointDelta,
  makeupCompletionUnit,
  groupedMakeupCompletionUnits,
  groupedOriginalCompletionUnits,
  summarizeCompletionUnits,
} from '../src/study/completionMetrics.ts';

test('keeps accepted items separate from actually completed workload', () => {
  const metrics = summarizeCompletionUnits([
    { itemAccepted: true, workloadCompleted: true },
    { itemAccepted: true, workloadCompleted: false },
  ]);

  assert.equal(metrics.itemPercent, 100);
  assert.equal(metrics.workloadPercent, 50);
  assert.equal(metrics.settlementPercent, 75);
});

test('calculates workload from item counts rather than time weights', () => {
  const metrics = summarizeCompletionUnits([
    { itemAccepted: true, workloadCompleted: true },
    { itemAccepted: false, workloadCompleted: false },
    { itemAccepted: false, workloadCompleted: false },
  ]);

  assert.equal(metrics.itemPercent, 33);
  assert.equal(metrics.workloadCompleted, 1);
  assert.equal(metrics.workloadTotal, 3);
  assert.equal(metrics.workloadPercent, 33);
  assert.equal(metrics.settlementPercent, 33);
});

test('formats Friday comparison as signed percentage points', () => {
  assert.equal(formatPercentagePointDelta(8), '+8%');
  assert.equal(formatPercentagePointDelta(-8), '-8%');
  assert.equal(formatPercentagePointDelta(0), '±0%');
});

test('adds today makeup work to workload without changing original item totals', () => {
  const metrics = summarizeCompletionUnits([
    { itemAccepted: true, workloadCompleted: true },
    makeupCompletionUnit(false),
  ]);

  assert.equal(metrics.itemCompleted, 1);
  assert.equal(metrics.itemTotal, 1);
  assert.equal(metrics.itemPercent, 100);
  assert.equal(metrics.workloadCompleted, 1);
  assert.equal(metrics.workloadTotal, 2);
  assert.equal(metrics.workloadPercent, 50);
});

test('includes completed deferred makeup in weekly workload without duplicating the original item', () => {
  const metrics = summarizeCompletionUnits([
    { itemAccepted: true, workloadCompleted: false },
    makeupCompletionUnit(true),
  ]);

  assert.equal(metrics.itemCompleted, 1);
  assert.equal(metrics.itemTotal, 1);
  assert.equal(metrics.itemPercent, 100);
  assert.equal(metrics.workloadCompleted, 1);
  assert.equal(metrics.workloadTotal, 2);
  assert.equal(metrics.workloadPercent, 50);
  assert.equal(metrics.settlementPercent, 75);
});

test('can count detailed original items as one top-level workload item', () => {
  const metrics = summarizeCompletionUnits([
    { workloadIncluded: false, itemAccepted: true, workloadCompleted: true },
    { workloadIncluded: false, itemAccepted: false, workloadCompleted: false },
    { itemIncluded: false, itemAccepted: false, workloadCompleted: false },
  ]);

  assert.equal(metrics.itemTotal, 2);
  assert.equal(metrics.workloadTotal, 1);
});

test('counts every grouped range or round child as a separate original item', () => {
  const metrics = summarizeCompletionUnits(groupedOriginalCompletionUnits([true, false, true]));
  assert.equal(metrics.itemTotal, 3);
  assert.equal(metrics.itemCompleted, 2);
  assert.equal(metrics.workloadTotal, 3);
  assert.equal(metrics.workloadCompleted, 2);
});

test('an independently deferred original child changes only its own accepted state', () => {
  const metrics = summarizeCompletionUnits([
    ...groupedOriginalCompletionUnits([false], true),
    ...groupedOriginalCompletionUnits([false], false),
  ]);
  assert.equal(metrics.itemTotal, 2);
  assert.equal(metrics.itemCompleted, 1);
  assert.equal(metrics.workloadCompleted, 0);
});

test('counts grouped deferred children only in actual workload', () => {
  const metrics = summarizeCompletionUnits(groupedMakeupCompletionUnits([true, false]));
  assert.equal(metrics.itemTotal, 0);
  assert.equal(metrics.workloadTotal, 2);
  assert.equal(metrics.workloadCompleted, 1);
});
