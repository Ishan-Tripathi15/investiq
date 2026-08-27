import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateIntelligenceAlertTriggers } from './intelligence-alert-trigger';

test('notifies high and critical actions first and respects the cap', () => {
  const result = evaluateIntelligenceAlertTriggers([
    { id: 'low', severity: 'low', title: 'Low', reason: 'r', action: 'a', source: 'portfolio' },
    { id: 'critical', severity: 'critical', title: 'Critical', reason: 'r', action: 'a', source: 'portfolio' },
    { id: 'high', severity: 'high', title: 'High', reason: 'r', action: 'a', source: 'goal' },
    { id: 'medium', severity: 'medium', title: 'Medium', reason: 'r', action: 'a', source: 'allocation' },
  ], { maxNotifications: 2 });
  const notified = result.filter((x) => x.shouldNotify);
  assert.equal(notified.length, 2);
  assert.deepEqual(notified.map((x) => x.actionId), ['critical', 'high']);
  assert.equal(result.find((x) => x.actionId === 'low')?.shouldNotify, false);
});

test('critical actions have immediate-attention reason', () => {
  const result = evaluateIntelligenceAlertTriggers([
    { id: 'critical', severity: 'critical', title: 'Risk', reason: 'r', action: 'a', source: 'portfolio' },
  ]);
  assert.equal(result[0]?.reason, 'Critical action requires immediate attention.');
});
