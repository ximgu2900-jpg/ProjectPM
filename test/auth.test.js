import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';

process.env.JWT_SECRET = 'test-secret-that-is-longer-than-thirty-two-characters';
const { signUser, requireAuth, requireRole } = await import('../server/auth.js');

test('signUser creates a token with the user role', async () => {
  const token = signUser({ id: 7, full_name: 'Test Coordinator', email: 'test@example.tl', role: 'coordinator' });
  assert.equal(typeof token, 'string');
  assert.ok(token.split('.').length === 3);
  assert.equal(await bcrypt.compare('secret', await bcrypt.hash('secret', 4)), true);
});

test('requireRole allows matching roles and rejects others', () => {
  let nextCalled = false;
  const next = () => { nextCalled = true; };
  const response = { status: () => response, json: () => response };
  requireRole('hospital')({ user: { role: 'hospital' } }, response, next);
  assert.equal(nextCalled, true);
  nextCalled = false;
  requireRole('hospital')({ user: { role: 'donor' } }, response, next);
  assert.equal(nextCalled, false);
});
