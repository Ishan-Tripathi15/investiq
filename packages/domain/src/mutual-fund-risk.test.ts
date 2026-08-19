import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateFundHistoricalStats } from './mutual-fund-risk';

const point = (date: string, nav: number) => ({ timestamp: `${date}T00:00:00.000Z`, nav });

test('mutual fund historical risk: calculates period return and CAGR from observed NAVs', () => {
  const stats = calculateFundHistoricalStats([
    point('2020-01-01', 100),
    point('2021-01-01', 110),
    point('2022-01-01', 121),
  ]);

  assert.ok(stats);
  assert.ok(Math.abs(stats.periodReturnPct - 21) < 0.00001);
  assert.ok(Math.abs(stats.cagrPct - 10) < 0.1);
  assert.equal(stats.observations, 3);
});

test('mutual fund historical risk: finds the deepest drawdown and its recovery', () => {
  const stats = calculateFundHistoricalStats([
    point('2020-01-01', 100),
    point('2020-02-01', 120),
    point('2020-03-01', 90),
    point('2020-04-01', 100),
    point('2020-05-01', 120),
  ]);

  assert.ok(stats);
  assert.ok(Math.abs(stats.maxDrawdownPct + 25) < 0.00001);
  assert.equal(stats.maxDrawdownRecoveryDate, '2020-05-01T00:00:00.000Z');
  assert.ok(Math.abs(stats.maxDrawdownRecoveryDays - 90) < 0.5);
});

test('mutual fund historical risk: keeps an unrecovered drawdown open through the final observation', () => {
  const stats = calculateFundHistoricalStats([
    point('2020-01-01', 100),
    point('2020-02-01', 80),
    point('2020-03-01', 85),
  ]);

  assert.ok(stats);
  assert.ok(Math.abs(stats.maxDrawdownPct + 20) < 0.00001);
  assert.equal(stats.maxDrawdownRecoveryDate, null);
  assert.ok(Math.abs(stats.longestDrawdownDays - 60) < 0.5);
});

test('mutual fund historical risk: returns zero volatility for a flat NAV series', () => {
  const stats = calculateFundHistoricalStats([
    point('2020-01-01', 100),
    point('2020-02-01', 100),
    point('2020-03-01', 100),
  ]);

  assert.ok(stats);
  assert.equal(stats.annualizedVolatilityPct, 0);
  assert.equal(stats.maxDrawdownPct, 0);
});
