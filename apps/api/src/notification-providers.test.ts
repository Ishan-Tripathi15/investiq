import { describe, expect, it } from 'vitest';
import { deliverSecurityNotification } from './notification-providers';

describe('notification providers', () => {
  it('fails closed when no push device is registered', async () => {
    const result = await deliverSecurityNotification({ channel: 'push', title: 'Security alert', message: 'Test', devices: [] });
    expect(result).toEqual([{ channel: 'push', provider: 'expo', status: 'unavailable', errorCode: 'NO_EXPO_DEVICE', errorMessage: 'No registered Expo push device is available.' }]);
  });

  it('does not claim email delivery when provider credentials are absent', async () => {
    const previousKey = process.env.RESEND_API_KEY;
    const previousFrom = process.env.NOTIFICATION_EMAIL_FROM;
    delete process.env.RESEND_API_KEY;
    delete process.env.NOTIFICATION_EMAIL_FROM;
    try {
      const result = await deliverSecurityNotification({ channel: 'email', title: 'Security alert', message: 'Test', email: 'customer@example.com' });
      expect(result[0]?.status).toBe('unavailable');
      expect(result[0]?.provider).toBe('resend');
    } finally {
      if (previousKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = previousKey;
      if (previousFrom === undefined) delete process.env.NOTIFICATION_EMAIL_FROM; else process.env.NOTIFICATION_EMAIL_FROM = previousFrom;
    }
  });

  it('does not claim SMS delivery when provider credentials are absent', async () => {
    const keys = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER'] as const;
    const previous = keys.map((key) => process.env[key]);
    keys.forEach((key) => delete process.env[key]);
    try {
      const result = await deliverSecurityNotification({ channel: 'sms', title: 'Security alert', message: 'Test', phone: '+911234567890' });
      expect(result[0]?.status).toBe('unavailable');
      expect(result[0]?.provider).toBe('twilio');
    } finally {
      keys.forEach((key, index) => {
        const value = previous[index];
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      });
    }
  });
});
