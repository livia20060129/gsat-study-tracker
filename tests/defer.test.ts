import assert from 'node:assert/strict';
import test from 'node:test';

import {
  countDeferredToDay,
  DEFERRED_TARGET_LIMIT,
  futureDeferredDays,
  hasDeferredTargetCapacity,
  nextDeferredDay,
} from '../src/study/deferDays.ts';

test('延期只列出本週原日期之後的星期', () => {
  assert.deepEqual(futureDeferredDays(1), [2, 3, 4, 5, 6, 0]);
  assert.deepEqual(futureDeferredDays(2), [3, 4, 5, 6, 0]);
  assert.deepEqual(futureDeferredDays(3), [4, 5, 6, 0]);
  assert.deepEqual(futureDeferredDays(4), [5, 6, 0]);
  assert.deepEqual(futureDeferredDays(5), [6, 0]);
  assert.deepEqual(futureDeferredDays(6), [0]);
  assert.deepEqual(futureDeferredDays(0), []);
});

test('預設延期日為下一個可用星期', () => {
  assert.equal(nextDeferredDay(5), 6);
  assert.equal(nextDeferredDay(6), 0);
  assert.equal(nextDeferredDay(0), null);
});

test('無效星期不產生延期選項', () => {
  assert.deepEqual(futureDeferredDays(-1), []);
  assert.deepEqual(futureDeferredDays(7), []);
});

test('每個目標日分別限制最多三個延期項目', () => {
  const fridayItems = Array.from({ length: DEFERRED_TARGET_LIMIT }, () => ({
    source: 'preset',
    required: true,
    deferred: true,
    done: false,
    deferredTargetDay: 5,
  }));
  const saturdayItem = {
    source: 'preset',
    required: true,
    deferred: true,
    done: false,
    deferredTargetDay: 6,
  };
  const ignoredItems = [
    { ...fridayItems[0], source: 'custom' },
    { ...fridayItems[0], deferredCarry: true },
    { ...fridayItems[0], done: true },
  ];
  const items = [...fridayItems, saturdayItem, ...ignoredItems];

  assert.equal(countDeferredToDay(items, 5), 3);
  assert.equal(countDeferredToDay(items, 6), 1);
  assert.equal(hasDeferredTargetCapacity(items, 5), false);
  assert.equal(hasDeferredTargetCapacity(items, 6), true);
});

test('編輯既有延期項目時不把自己重複計入上限', () => {
  const selectedItem = {
    source: 'preset',
    required: true,
    deferred: true,
    done: false,
    deferredTargetDay: 5,
  };
  const items = [selectedItem, { ...selectedItem }, { ...selectedItem }];

  assert.equal(countDeferredToDay(items, 5, selectedItem), 2);
  assert.equal(hasDeferredTargetCapacity(items, 5, selectedItem), true);
});
