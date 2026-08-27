import test from 'node:test';
import assert from 'node:assert/strict';
import { decideIntelligenceNotifications } from './notification-intelligence-control';

const alert = (id: string, severity: 'critical' | 'high' | 'medium' | 'low', source: 'portfolio' | 'allocation' | 'goal') => ({
  id, severity, source, title: id, reason: 'reason', action: 'action',
});

test('filters alerts by severity and source', () => {
  const result = decideIntelligenceNotifications(
    [alert('critical-risk', 'critical', 'portfolio'), alert('low-goal', 'low', 'goal')],
    { enabled: true, minimumSeverity: 'high', enabledSources: ['portfolio'] },
  );
  assert.equal(result[0]?.deliver, true);
  assert.equal(result[1]?.deliver, false);
});

test('quiet hours suppress non-critical alerts but critical alerts bypass', () => {
  const result = decideIntelligenceNotifications(
    [alert('critical', 'critical', 'portfolio'), alert('high', 'high', 'goal')],
    { enabled: true, quietHours: { start: '22:00', end: '07:00' } },
    '23:30',
  );
  assert.equal(result[0]?.deliver, true);
  assert.equal(result[0]?.reason, 'Critical alert bypasses quiet hours.');
  assert.equal(result[1]?.deliver, false);
});

test('digest mode is preserved for matching alerts', () => {
  const result = decideIntelligenceNotifications(
    [alert('goal', 'medium', 'goal')],
    { enabled: true, deliveryMode: 'digest' },
  );
  assert.equal(result[0]?.mode, 'digest');
});
