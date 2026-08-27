import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProactiveIntelligenceAlerts } from './proactive-intelligence-alerts';

test('proactive alerts deduplicate and prioritize actions', () => {
  const result = buildProactiveIntelligenceAlerts({
    actions: [
      { id: 'goal-1', severity: 'high', title: 'Funding gap: Home', reason: 'Gap is ₹1,000,000.', action: 'Increase contribution.', source: 'goal' },
      { id: 'risk-1', severity: 'critical', title: 'Portfolio risk warning', reason: 'Concentration is high.', action: 'Diversify.', source: 'portfolio' },
      { id: 'dup', severity: 'medium', title: 'Funding gap: Home', reason: 'Gap is ₹1,000,000.', action: 'Increase contribution.', source: 'goal' },
    ],
  });
  assert.equal(result.length, 2);
  assert.equal(result[0]?.severity, 'critical');
  assert.equal(result[1]?.severity, 'high');
  assert.equal(result[1]?.fingerprint, result[0]?.fingerprint === result[1]?.fingerprint ? 'bad' : result[1]?.fingerprint);
});

test('proactive alerts enforce a safe maximum', () => {
  assert.throws(() => buildProactiveIntelligenceAlerts({ actions: [], maxAlerts: 0 }), /maxAlerts must be between 1 and 50/);
  assert.throws(() => buildProactiveIntelligenceAlerts({ actions: [], maxAlerts: 51 }), /maxAlerts must be between 1 and 50/);
});
