import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldSendIntelligenceDigest } from './intelligence-digest-scheduler';

test('sends a daily digest at the configured time', () => {
  const result = shouldSendIntelligenceDigest({
    schedule: { cadence: 'daily', hour: 9, minute: 0, timezone: 'Asia/Kolkata' },
    now: { dayOfWeek: 4, hour: 9, minute: 0 },
  });
  assert.equal(result.shouldSend, true);
});

test('weekly digest is Monday-only and avoids duplicate same-day sends', () => {
  assert.equal(shouldSendIntelligenceDigest({
    schedule: { cadence: 'weekly', hour: 9, minute: 0, timezone: 'Asia/Kolkata' },
    now: { dayOfWeek: 3, hour: 9, minute: 0 },
  }).shouldSend, false);
  assert.equal(shouldSendIntelligenceDigest({
    schedule: { cadence: 'weekly', hour: 9, minute: 0, timezone: 'Asia/Kolkata' },
    now: { dayOfWeek: 1, hour: 9, minute: 0 },
    lastSentAt: new Date().toISOString(),
  }).shouldSend, false);
});

test('rejects invalid schedule times', () => {
  assert.throws(() => shouldSendIntelligenceDigest({
    schedule: { cadence: 'daily', hour: 24, minute: 0, timezone: 'Asia/Kolkata' },
    now: { dayOfWeek: 1, hour: 24, minute: 0 },
  }), /Invalid digest schedule time/);
});
