import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUnifiedIntelligenceSnapshot } from './unified-intelligence-snapshot';

test('aggregates actions, alerts and notification counts', () => {
  const result = buildUnifiedIntelligenceSnapshot({
    actions: [
      { id: 'a', severity: 'critical', title: 'Risk', reason: 'Risk', action: 'Review', source: 'portfolio' },
      { id: 'b', severity: 'high', title: 'Goal', reason: 'Gap', action: 'Contribute', source: 'goal' },
    ],
    alerts: [
      { id: 'a', severity: 'critical', title: 'Risk', message: 'Risk', action: 'Review', source: 'portfolio', fingerprint: 'risk' },
      { id: 'b', severity: 'medium', title: 'Goal', message: 'Gap', action: 'Contribute', source: 'goal', fingerprint: 'goal' },
    ],
    notifications: [
      { eventType: 'portfolio.action', severity: 'critical', title: 'Risk', message: 'Review', metadata: { actionId: 'a', source: 'portfolio' } },
    ],
    generatedAt: '2026-08-27T00:00:00.000Z',
  });
  assert.equal(result.counts.actions.critical, 1);
  assert.equal(result.counts.actions.high, 1);
  assert.equal(result.counts.alerts.critical, 1);
  assert.equal(result.counts.alerts.medium, 1);
  assert.equal(result.counts.notifications, 1);
  assert.equal(result.generatedAt, '2026-08-27T00:00:00.000Z');
});
