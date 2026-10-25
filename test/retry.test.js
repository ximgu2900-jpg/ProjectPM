import test from 'node:test';
import assert from 'node:assert/strict';
import { backoffSeconds, isTerminalAttempt } from '../server/retry.js';

test('retry backoff grows and is capped at one hour', () => {
  assert.equal(backoffSeconds(1), 30);
  assert.equal(backoffSeconds(2), 60);
  assert.equal(backoffSeconds(5), 480);
  assert.equal(backoffSeconds(20), 3600);
});

test('retry attempts become terminal at the configured limit', () => {
  assert.equal(isTerminalAttempt(4, 5), false);
  assert.equal(isTerminalAttempt(5, 5), true);
  assert.equal(isTerminalAttempt(6, 5), true);
});
