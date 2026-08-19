import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAuthRisk } from './auth-risk';

test('known device and network with MFA is low risk', () => {
  const result = evaluateAuthRisk({ hasKnownDevice: true, hasKnownIp: true, hasMfa: true, failedAttempts: 0 });
  assert.equal(result.decision, 'allow');
  assert.equal(result.score, 0);
});

test('new device requires step-up', () => {
  const result = evaluateAuthRisk({ hasKnownDevice: false, hasKnownIp: true, hasMfa: true, failedAttempts: 0 });
  assert.equal(result.decision, 'step_up');
  assert.ok(result.reasons.includes('new_device'));
});

test('high risk combination blocks', () => {
  const result = evaluateAuthRisk({ hasKnownDevice: false, hasKnownIp: false, hasMfa: true, failedAttempts: 3, isPasswordResetFlow: true });
  assert.equal(result.decision, 'block');
});

test('MFA enrollment is required when no MFA exists', () => {
  const result = evaluateAuthRisk({ hasKnownDevice: true, hasKnownIp: true, hasMfa: false, failedAttempts: 0 });
  assert.equal(result.decision, 'step_up');
  assert.ok(result.reasons.includes('mfa_not_enabled'));
});
