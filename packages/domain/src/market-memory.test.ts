import test from 'node:test';
import assert from 'node:assert/strict';
import { queryMarketMemory, summarizePortfolioMemory } from './market-memory';

const source = { provider: 'test', retrievedAt: '2026-08-20T00:00:00.000Z', verified: true };

test('market memory filters to verified observations and preserves provenance', () => {
  const result = queryMarketMemory([
    { timestamp: '2024-01-01T00:00:00.000Z', symbol: 'RELIANCE', regime: 'bull', price: 100, source },
    { timestamp: '2024-02-01T00:00:00.000Z', symbol: 'RELIANCE', regime: 'bear', price: 80, source: { ...source, verified: false } },
    { timestamp: '2024-03-01T00:00:00.000Z', symbol: 'TCS', regime: 'sideways', price: 90, source },
  ], { symbol: 'RELIANCE' });
  assert.equal(result.observations, 1);
  assert.deepEqual(result.sources, ['test']);
  assert.equal(result.points[0]?.regime, 'bull');
});

test('portfolio memory summarizes regime exposure and concentration', () => {
  const result = summarizePortfolioMemory([
    { symbol: 'A', weightPct: 60, regimes: ['bull', 'high_volatility'] },
    { symbol: 'B', weightPct: 40, regimes: ['bear'] },
  ]);
  assert.equal(result.largestPositionPct, 60);
  assert.equal(result.regimeExposure.bull, 30);
  assert.equal(result.regimeExposure.high_volatility, 30);
  assert.equal(result.regimeExposure.bear, 40);
});
