import assert from 'node:assert/strict';
import test from 'node:test';

import { completionCelebrationForChange } from '../src/study/completionCelebration.ts';

test('celebrates only after crossing above fifty percent', () => {
  assert.equal(completionCelebrationForChange(40, 50), null);
  assert.equal(completionCelebrationForChange(50, 60), 'half');
});

test('uses the stronger message when one completion reaches one hundred percent', () => {
  assert.equal(completionCelebrationForChange(50, 100), 'complete');
  assert.equal(completionCelebrationForChange(80, 100), 'complete');
});

test('does not repeat a milestone that was already celebrated', () => {
  assert.equal(completionCelebrationForChange(50, 60, { half: true }), null);
  assert.equal(completionCelebrationForChange(90, 100, { complete: true }), null);
});

test('ignores unchecking, sync, and denominator-only percentage changes', () => {
  assert.equal(completionCelebrationForChange(60, 40), null);
  assert.equal(completionCelebrationForChange(40, 60, {}, false), null);
});
