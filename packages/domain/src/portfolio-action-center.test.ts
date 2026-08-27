import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPortfolioActionCenter } from './portfolio-action-center';

test('prioritizes critical portfolio warnings and high-priority goal gaps', () => {
  const result = buildPortfolioActionCenter({
    portfolio: { riskLevel: 'critical', warnings: ['Single-position concentration is above 40% of equity.'], actions: ['Review the largest position.'] },
    rebalance: { needsRebalance: true, actions: [{ assetClass: 'stock', action: 'sell', amount: 250000, driftPct: 25 }, { assetClass: 'cash', action: 'hold', amount: 0, driftPct: 0 }] },
    goals: [{ name: 'Home', priority: 'high', gap: 1000000, requiredMonthlyContribution: 15000 }],
  });
  assert.equal(result.actions[0]?.severity, 'critical');
  assert.equal(result.actions[1]?.severity, 'high');
  assert.equal(result.summary.critical, 1);
  assert.equal(result.summary.high, 2);
});

test('returns an all-clear action when no warnings or gaps exist', () => {
  const result = buildPortfolioActionCenter({
    portfolio: { riskLevel: 'low', warnings: [], actions: [] },
    rebalance: { needsRebalance: false, actions: [{ assetClass: 'stock', action: 'hold', amount: 0, driftPct: 0 }] },
    goals: [],
  });
  assert.equal(result.actions.length, 1);
  assert.equal(result.actions[0]?.id, 'all-clear');
});
