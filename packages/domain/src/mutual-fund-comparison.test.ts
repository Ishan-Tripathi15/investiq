import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFundComparison, scoreHistoricalFunds } from './mutual-fund-comparison';

const pointsA = [
  { timestamp: '2020-01-01T00:00:00Z', nav: 100 },
  { timestamp: '2021-01-01T00:00:00Z', nav: 120 },
  { timestamp: '2022-01-01T00:00:00Z', nav: 150 },
  { timestamp: '2023-01-01T00:00:00Z', nav: 180 },
  { timestamp: '2024-01-01T00:00:00Z', nav: 210 },
  { timestamp: '2025-01-01T00:00:00Z', nav: 240 },
];

const pointsB = [
  { timestamp: '2020-01-01T00:00:00Z', nav: 100 },
  { timestamp: '2021-01-01T00:00:00Z', nav: 115 },
  { timestamp: '2022-01-01T00:00:00Z', nav: 130 },
  { timestamp: '2023-01-01T00:00:00Z', nav: 145 },
  { timestamp: '2024-01-01T00:00:00Z', nav: 160 },
  { timestamp: '2025-01-01T00:00:00Z', nav: 175 },
];

test('mutual fund comparison: builds comparable historical metrics', () => {
  const result = buildFundComparison({ key: '1:100', points: pointsA });
  assert.equal(result.risk?.observations, 6);
  assert.ok((result.risk?.cagrPct ?? 0) > 0);
  assert.ok(result.rolling.some((item) => item.windowYears === 3));
});

test('mutual fund comparison: scores funds descriptively without forecasting', () => {
  const results = scoreHistoricalFunds([
    buildFundComparison({ key: '1:100', points: pointsA }),
    buildFundComparison({ key: '2:200', points: pointsB }),
  ]);
  assert.equal(results.length, 2);
  assert.ok((results[0]?.score ?? 0) > (results[1]?.score ?? 0));
  assert.ok(results[0]?.strengths.includes('Highest historical CAGR'));
});
