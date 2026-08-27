import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIntelligenceDigest } from './intelligence-digest';

test('summarizes critical and high actions', () => {
  const result = buildIntelligenceDigest({
    actions: [
      { id: 'c', severity: 'critical', title: 'Risk', reason: 'r', action: 'a', source: 'portfolio' },
      { id: 'h', severity: 'high', title: 'Goal', reason: 'r', action: 'a', source: 'goal' },
      { id: 'm', severity: 'medium', title: 'Allocation', reason: 'r', action: 'a', source: 'allocation' },
    ],
    alerts: [],
    generatedAt: '2026-08-27T00:00:00.000Z',
  });
  assert.equal(result.criticalCount, 1);
  assert.equal(result.highCount, 1);
  assert.match(result.summary, /1 critical action and 1 high-priority action/);
});

test('reports no urgent actions when none exist', () => {
  const result = buildIntelligenceDigest({ actions: [], alerts: [] });
  assert.equal(result.criticalCount, 0);
  assert.equal(result.highCount, 0);
  assert.match(result.summary, /No critical or high-priority/);
});
