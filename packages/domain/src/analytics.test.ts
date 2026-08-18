import { strict as assert } from 'node:assert';
import test from 'node:test';
import { calculateCagr, calculateDrawdowns, calculateStats, historicalEventOutcomes } from './analytics';

test('calculateCagr returns annualized growth', () => {
  assert.ok(Math.abs(calculateCagr(100, 121, 2) - 10) < 0.0001);
});

test('calculateDrawdowns tracks peak-to-trough decline', () => {
  const result = calculateDrawdowns([
    { timestamp: '2025-01-01', close: 100 },
    { timestamp: '2025-01-02', close: 120 },
    { timestamp: '2025-01-03', close: 90 },
  ]);
  assert.equal(result[2].drawdownPct, -25);
});

test('calculateStats exposes core historical risk metrics', () => {
  const result = calculateStats([
    { timestamp: '2024-01-01', close: 100 },
    { timestamp: '2024-07-01', close: 110 },
    { timestamp: '2025-01-01', close: 121 },
  ]);
  assert.equal(Math.round(result.absoluteReturnPct), 21);
  assert.ok(result.maxDrawdownPct <= 0);
});

test('historicalEventOutcomes measures only observed future windows', () => {
  const result = historicalEventOutcomes([
    { timestamp: '2025-01-01', close: 100 },
    { timestamp: '2025-01-02', close: 90 },
    { timestamp: '2025-01-03', close: 99 },
    { timestamp: '2025-01-04', close: 108 },
  ], -5, [1]);
  assert.equal(result[0].observations, 1);
  assert.equal(result[0].positivePct, 100);
});
