import { describe, expect, it } from 'vitest';
import { calculateFundHistoricalStats } from './mutual-fund-risk';

const point = (date: string, nav: number) => ({ timestamp: `${date}T00:00:00.000Z`, nav });

describe('mutual fund historical risk', () => {
  it('calculates period return and CAGR from observed NAVs', () => {
    const stats = calculateFundHistoricalStats([
      point('2020-01-01', 100),
      point('2021-01-01', 110),
      point('2022-01-01', 121),
    ]);

    expect(stats).not.toBeNull();
    expect(stats!.periodReturnPct).toBeCloseTo(21, 5);
    expect(stats!.cagrPct).toBeCloseTo(10, 1);
    expect(stats!.observations).toBe(3);
  });

  it('finds the deepest drawdown and its recovery', () => {
    const stats = calculateFundHistoricalStats([
      point('2020-01-01', 100),
      point('2020-02-01', 120),
      point('2020-03-01', 90),
      point('2020-04-01', 100),
      point('2020-05-01', 120),
    ]);

    expect(stats).not.toBeNull();
    expect(stats!.maxDrawdownPct).toBeCloseTo(-25, 5);
    expect(stats!.maxDrawdownRecoveryDate).toBe('2020-05-01T00:00:00.000Z');
    expect(stats!.maxDrawdownRecoveryDays).toBeCloseTo(91, 0);
  });

  it('keeps an unrecovered drawdown open through the final observation', () => {
    const stats = calculateFundHistoricalStats([
      point('2020-01-01', 100),
      point('2020-02-01', 80),
      point('2020-03-01', 85),
    ]);

    expect(stats).not.toBeNull();
    expect(stats!.maxDrawdownPct).toBeCloseTo(-20, 5);
    expect(stats!.maxDrawdownRecoveryDate).toBeNull();
    expect(stats!.longestDrawdownDays).toBeCloseTo(60, 0);
  });

  it('returns zero volatility for a flat NAV series', () => {
    const stats = calculateFundHistoricalStats([
      point('2020-01-01', 100),
      point('2020-02-01', 100),
      point('2020-03-01', 100),
    ]);

    expect(stats).not.toBeNull();
    expect(stats!.annualizedVolatilityPct).toBe(0);
    expect(stats!.maxDrawdownPct).toBe(0);
  });
});
