import { describe, expect, it } from 'vitest';
import { analyzeFundGoal, simulateHistoricalLumpsum, simulateHistoricalLumpsumAt } from './mutual-fund-simulator';

const points = [
  { timestamp: '2020-01-01T00:00:00.000Z', nav: 100 },
  { timestamp: '2021-01-01T00:00:00.000Z', nav: 120 },
  { timestamp: '2022-01-01T00:00:00.000Z', nav: 150 },
  { timestamp: '2023-01-01T00:00:00.000Z', nav: 180 },
];

describe('mutual fund simulator', () => {
  it('simulates a historical lumpsum from the first observed NAV', () => {
    const result = simulateHistoricalLumpsum(points, 10000)!;
    expect(result.units).toBe(100);
    expect(result.endingValue).toBe(18000);
    expect(result.profit).toBe(8000);
    expect(result.absoluteReturnPct).toBe(80);
    expect(result.annualizedReturnPct).toBeGreaterThan(21);
  });

  it('supports a specific historical start date and horizon', () => {
    const result = simulateHistoricalLumpsumAt(points, 50000, '2021-01-01T00:00:00.000Z', 2)!;
    expect(result.startNav).toBe(120);
    expect(result.endNav).toBe(180);
    expect(result.endingValue).toBe(75000);
  });

  it('calculates scenario-based goal requirements', () => {
    const result = analyzeFundGoal(1000000, 10, { conservative: 8, base: 12, optimistic: 15 });
    expect(result.scenarios).toHaveLength(3);
    expect(result.scenarios[0]!.requiredInitialInvestment).toBeCloseTo(463193, -1);
    expect(result.scenarios[1]!.requiredInitialInvestment).toBeLessThan(result.scenarios[0]!.requiredInitialInvestment);
    expect(result.scenarios[2]!.requiredInitialInvestment).toBeLessThan(result.scenarios[1]!.requiredInitialInvestment);
  });
});
