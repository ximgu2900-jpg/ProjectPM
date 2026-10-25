import test from 'node:test';
import assert from 'node:assert/strict';
import { requireChoice, requireText, validBloodTypes, validFinalStatuses, validUrgencies } from '../server/validation.js';

test('requireText trims valid input', () => {
  assert.equal(requireText('  Dili  ', 'municipality'), 'Dili');
});

test('requireText rejects blank input with a client error', () => {
  assert.throws(() => requireText('   ', 'patientName'), (error) => (
    error.statusCode === 400 && error.message === 'patientName is required'
  ));
});

test('requireChoice accepts supported blood types and statuses', () => {
  assert.equal(requireChoice('O+', 'bloodType', validBloodTypes), 'O+');
  assert.equal(requireChoice('Fulfilled', 'status', validFinalStatuses), 'Fulfilled');
  assert.equal(requireChoice('Urgente', 'urgency', validUrgencies), 'Urgente');
});

test('requireChoice rejects unsupported values', () => {
  assert.throws(() => requireChoice('C+', 'bloodType', validBloodTypes), /bloodType is invalid/);
  assert.throws(() => requireChoice('Unknown', 'status', validFinalStatuses), /status is invalid/);
});
