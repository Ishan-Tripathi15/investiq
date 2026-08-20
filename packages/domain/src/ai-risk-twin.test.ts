import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRiskTwin } from './ai-risk-twin';

test('risk twin calculates concentration and stress scenarios', () => {
  const result = buildRiskTwin({ equity: 100000, availableCash: 10000, positions: [
    { symbol: 'RELIANCE', marketValue: 50000, sector: 'Energy' },
    { symbol: 'TCS', marketValue: 30000, sector: 'IT' },
    { symbol: 'HDFCBANK', marketValue: 10000, sector: 'Financials' },
  ] });
  assert.equal(result.investedValue, 90000);
  assert.equal(result.concentrationPct, 50);
  assert.equal(result.largestPosition?.symbol, 'RELIANCE');
  const twenty = result.scenarios.find((scenario) => scenario.scenario === 'drawdown_20');
  assert.equal(twenty?.lossAmount, 18000);
  assert.equal(twenty?.portfolioValueAfter, 82000);
  assert.equal(twenty?.breachedDrawdownLimit, false);
});

test('risk twin flags concentrated portfolios and severe stress', () => {
  const result = buildRiskTwin({ equity: 100000, availableCash: 2000, maxDrawdownPct: 15, positions: [{ symbol: 'ABC', marketValue: 98000 }] });
  assert.ok(result.warnings.some((warning) => warning.includes('concentration')));
  assert.ok(result.warnings.some((warning) => warning.includes('Cash buffer')));
  assert.ok(result.scenarios.find((scenario) => scenario.scenario === 'bear_regime')?.breachedDrawdownLimit);
});
