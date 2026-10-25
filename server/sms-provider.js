import 'dotenv/config';

function requireSetting(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing SMS provider setting: ${name}`);
  return value;
}

export function getSmsProvider() {
  const provider = process.env.SMS_PROVIDER || 'disabled';
  if (provider === 'disabled') {
    return {
      name: provider,
      send: async () => {
        throw new Error('SMS provider is disabled; set SMS_PROVIDER before starting the worker');
      },
    };
  }

  if (provider === 'console') {
    return {
      name: provider,
      send: async ({ to, body }) => {
        console.log(`[sms:console] ${to}: ${body}`);
      },
    };
  }

  if (provider === 'twilio') {
    const accountSid = requireSetting('TWILIO_ACCOUNT_SID');
    const authToken = requireSetting('TWILIO_AUTH_TOKEN');
    const from = requireSetting('SMS_FROM');
    return {
      name: provider,
      send: async ({ to, body }) => {
        const encoded = new URLSearchParams({ To: to, From: from, Body: body });
        const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
          { method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: encoded },
        );
        if (!response.ok) throw new Error(`Twilio returned HTTP ${response.status}`);
      },
    };
  }

  throw new Error(`Unsupported SMS_PROVIDER: ${provider}`);
}
