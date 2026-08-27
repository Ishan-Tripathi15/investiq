import test from 'node:test';
import assert from 'node:assert/strict';
import { toLiveIntelligenceNotification } from './live-intelligence-notifications';

test('maps critical actions to critical live notifications', () => {
  const result = toLiveIntelligenceNotification('user-1', {
    id: 'risk-1', severity: 'critical', title: 'Portfolio risk', reason: 'Concentration is high.',
    action: 'Review exposure.', source: 'portfolio', amount: 250000,
  });
  assert.equal(result.severity, 'critical');
  assert.equal(result.eventType, 'portfolio.action');
  assert.equal(result.metadata.amount, 250000);
});

test('maps high actions to warnings and lower severities to info', () => {
  assert.equal(toLiveIntelligenceNotification('u', { id: 'h', severity: 'high', title: 'H', reason: 'r', action: 'a', source: 'goal' }).severity, 'warning');
  assert.equal(toLiveIntelligenceNotification('u', { id: 'm', severity: 'medium', title: 'M', reason: 'r', action: 'a', source: 'allocation' }).severity, 'info');
  assert.throws(() => toLiveIntelligenceNotification('', { id: 'x', severity: 'low', title: 'x', reason: 'r', action: 'a', source: 'portfolio' }), /userId is required/);
});
