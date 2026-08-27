import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRebalanceAdvice } from './rebalance-advisor';

test('rebalance advisor sizes buy and sell actions from allocation drift', () => {
  const result = buildRebalanceAdvice(
    [
      { assetClass: 'stock', marketValue: 800000 },
      { assetClass: 'mutual_fund', marketValue: 100000 },
      { assetClass: 'cash', marketValue: 100000 },
    ],
    [
      { assetClass: 'stock', targetPct: 60, tolerancePct: 2 },
      { assetClass: 'mutual_fund', targetPct: 30, tolerancePct: 2 },
      { assetClass: 'cash', targetPct: 10, tolerancePct: 2 },
    ],
  );
  assert.equal(result.portfolioValue, 1000000);
  assert.equal(result.actions[0]?.action, 'sell');
  assert.equal(result.actions[0]?.amount, 200000);
  assert.equal(result.actions[1]?.action, 'buy');
  assert.equal(result.actions[1]?.amount, 200000);
  assert.equal(result.actions[2]?.action, 'hold');
  assert.equal(result.needsRebalance, true);
});

test('rebalance advisor rejects targets that do not total 100%', () => {
  assert.throws(
    () => buildRebalanceAdvice([], [{ assetClass: 'stock', targetPct: 80 }]),
    /Target allocations must total 100%/,
  );
});

test('rebalance advisor respects tolerance bands', () => {
  const result = buildRebalanceAdvice(
    [
      { assetClass: 'stock', marketValue: 610000 },
      { assetClass: 'mutual_fund', marketValue: 290000 },
      { assetClass: 'cash', marketValue: 100000 },
    ],
    [
      { assetClass: 'stock', targetPct: 60, tolerancePct: 2 },
      { assetClass: 'mutual_fund', targetPct: 30, tolerancePct: 2 },
      { assetClass: 'cash', targetPct: 10, tolerancePct: 2 },
    ],
  );
  assert.equal(result.needsRebalance, false);
  assert.ok(result.actions.every((action) => action.action === 'hold'));
});
