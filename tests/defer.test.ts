import assert from 'node:assert/strict';
import test from 'node:test';

import { futureDeferredDays, nextDeferredDay } from '../src/study/deferDays.ts';

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
