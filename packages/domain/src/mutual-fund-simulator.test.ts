import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFundGoal, simulateHistoricalLumpsum, simulateHistoricalLumpsumAt } from './mutual-fund-simulator';

const points = [
  { timestamp: '2020-01-01T00:00:00.000Z', nav: 100 },
  { timestamp: '2021-01-01T00:00:00.000Z', nav: 120 },
  { timestamp: '2022-01-01T00:00:00.000Z', nav: 150 },
  { timestamp: '2023-01-01T00:00:00.000Z', nav: 180 },
];

test('mutual fund simulator: historical lumpsum from first observed NAV', () => {
  const result = simulateHistoricalLumpsum(points, 10000);
  assert.ok(result);
  assert.equal(result.units, 100);
  assert.equal(result.endingValue, 18000);
  assert.equal(result.profit, 8000);
  assert.equal(result.absoluteReturnPct, 80);
  assert.ok(result.annualizedReturnPct > 21);
});

test('mutual fund simulator: specific historical start date and horizon', () => {
  const result = simulateHistoricalLumpsumAt(points, 50000, '2021-01-01T00:00:00.000Z', 2);
  assert.ok(result);
  assert.equal(result.startNav, 120);
  assert.equal(result.endNav, 180);
  assert.equal(result.endingValue, 75000);
});

test('mutual fund simulator: scenario-based goal requirements', () => {
  const result = analyzeFundGoal(1000000, 10, { conservative: 8, base: 12, optimistic: 15 });
  assert.equal(result.scenarios.length, 3);
  assert.ok(Math.abs(result.scenarios[0]!.requiredInitialInvestment - 463193) < 20);
  assert.ok(result.scenarios[1]!.requiredInitialInvestment < result.scenarios[0]!.requiredInitialInvestment);
  assert.ok(result.scenarios[2]!.requiredInitialInvestment < result.scenarios[1]!.requiredInitialInvestment);
});
