import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCrossAssetIntelligence } from './cross-asset-intelligence';

test('cross-asset intelligence: combines asset classes and ranks goal gaps by priority', () => {
  const result = buildCrossAssetIntelligence({
    holdings: [
      { symbol: 'ABC', assetClass: 'stock', marketValue: 600000, expectedAnnualReturnPct: 11 },
      { symbol: 'FUND', assetClass: 'mutual_fund', marketValue: 300000, expectedAnnualReturnPct: 9 },
      { symbol: 'CASH', assetClass: 'cash', marketValue: 100000, expectedAnnualReturnPct: 0 },
    ],
    goals: [
      { name: 'Car', targetValue: 1000000, years: 3, priority: 'low' },
      { name: 'Home', targetValue: 5000000, years: 5, priority: 'high' },
    ],
    monthlyContribution: 25000,
  });
  assert.equal(result.totalPortfolioValue, 1000000);
  assert.equal(result.allocation.length, 3);
  assert.ok(Math.abs((result.weightedExpectedReturnPct ?? 0) - 9.3) < 0.000001);
  assert.equal(result.goals[0]?.name, 'Home');
  assert.ok((result.goals[0]?.requiredMonthlyContribution ?? 0) > 0);
  assert.ok(result.actions.some((action) => action.includes('high-priority')));
});

test('cross-asset intelligence: preserves unavailable return data', () => {
  const result = buildCrossAssetIntelligence({
    holdings: [{ symbol: 'CASH', assetClass: 'cash', marketValue: 100000 }],
    goals: [{ name: 'Goal', targetValue: 100000, years: 1 }],
  });
  assert.equal(result.weightedExpectedReturnPct, undefined);
  assert.ok(result.warnings.some((warning) => warning.includes('diversification')));
});

test('cross-asset intelligence: rejects invalid contribution assumptions', () => {
  assert.throws(
    () => buildCrossAssetIntelligence({ holdings: [], goals: [], monthlyContribution: -1 }),
    /Monthly contribution must be non-negative/,
  );
});
