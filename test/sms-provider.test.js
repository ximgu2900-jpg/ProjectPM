import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SMS_PROVIDER = 'disabled';
const { getSmsProvider } = await import('../server/sms-provider.js');

test('disabled SMS provider never sends', async () => {
  const provider = getSmsProvider();
  assert.equal(provider.name, 'disabled');
  await assert.rejects(
    provider.send({ to: '+6707000000', body: 'test' }),
    /SMS provider is disabled/,
  );
});
