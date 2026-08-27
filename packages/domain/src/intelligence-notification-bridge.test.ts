import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIntelligenceNotifications } from './intelligence-notification-bridge';

test('maps top portfolio actions into notification-safe events', () => {
  const result = buildIntelligenceNotifications([
    { id: 'low', severity: 'low', title: 'Monitor', reason: 'Monitor', action: 'Continue monitoring.', source: 'portfolio' },
    { id: 'critical', severity: 'critical', title: 'Risk', reason: 'High risk.', action: 'Review exposure.', source: 'portfolio', amount: 100000 },
    { id: 'high', severity: 'high', title: 'Goal', reason: 'Funding gap.', action: 'Increase contribution.', source: 'goal' },
  ]);
  assert.equal(result.length, 3);
  assert.equal(result[0]?.severity, 'critical');
  assert.equal(result[0]?.eventType, 'portfolio.action');
  assert.equal(result[0]?.metadata.amount, 100000);
  assert.equal(result[1]?.severity, 'warning');
  assert.equal(result[2]?.severity, 'info');
});

test('limits notification fan-out', () => {
  assert.equal(buildIntelligenceNotifications([
    { id: 'a', severity: 'low', title: 'A', reason: 'A', action: 'A', source: 'portfolio' },
    { id: 'b', severity: 'low', title: 'B', reason: 'B', action: 'B', source: 'goal' },
  ], 1).length, 1);
  assert.throws(() => buildIntelligenceNotifications([], 0), /limit must be between 1 and 10/);
});
