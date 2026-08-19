import { describe, expect, it } from 'vitest';
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

describe('mutual fund comparison', () => {
  it('builds comparable historical metrics', () => {
    const result = buildFundComparison({ key: '1:100', points: pointsA });
    expect(result.risk?.observations).toBe(6);
    expect(result.risk?.cagrPct).toBeGreaterThan(0);
    expect(result.rolling.some((item) => item.windowYears === 3)).toBe(true);
  });

  it('scores funds descriptively without forecasting', () => {
    const results = scoreHistoricalFunds([
      buildFundComparison({ key: '1:100', points: pointsA }),
      buildFundComparison({ key: '2:200', points: pointsB }),
    ]);
    expect(results).toHaveLength(2);
    expect(results[0]?.score).toBeGreaterThan(results[1]?.score ?? 0);
    expect(results[0]?.strengths).toContain('Highest historical CAGR');
  });
});
