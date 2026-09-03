import assert from 'node:assert/strict';
import test from 'node:test';

import { withCrossTabLock } from '../src/storage/crossTabLock.ts';

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function nextTurn(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

test('fallback lock serializes operations for the same study date', async () => {
  const blocker = deferred();
  const order: string[] = [];

  const first = withCrossTabLock('record:2026-09-03', async () => {
    order.push('first:start');
    await blocker.promise;
    order.push('first:end');
  }, null);
  const second = withCrossTabLock('record:2026-09-03', async () => {
    order.push('second:start');
  }, null);

  await nextTurn();
  assert.deepEqual(order, ['first:start']);
  blocker.resolve();
  await Promise.all([first, second]);
  assert.deepEqual(order, ['first:start', 'first:end', 'second:start']);
});

test('fallback lock does not block a different study date', async () => {
  const blocker = deferred();
  const started: string[] = [];

  const first = withCrossTabLock('record:2026-09-03', async () => {
    started.push('09-03');
    await blocker.promise;
  }, null);
  const second = withCrossTabLock('record:2026-09-04', async () => {
    started.push('09-04');
  }, null);

  await nextTurn();
  assert.deepEqual(new Set(started), new Set(['09-03', '09-04']));
  blocker.resolve();
  await Promise.all([first, second]);
});
