import { describe, expect, it } from 'vitest';
import { buildCrossAssetIntelligence } from './cross-asset-intelligence';

describe('buildCrossAssetIntelligence', () => {
  it('combines asset classes and ranks goal gaps by priority', () => {
    const result = buildCrossAssetIntelligence({
      holdings: [
        { symbol: 'ABC', assetClass: 'stock', marketValue: 600000, expectedAnnualReturnPct: 11 },
        { symbol: 'FUND', assetClass: 'mutual_fund', marketValue: 300000, expectedAnnualReturnPct: 9 },
        { symbol: 'CASH', assetClass: 'cash', marketValue: 100000, expectedAnnualReturnPct: 0 },
      ],
      goals: [
        { name: 'Car', targetValue: 1000000, years: 3, priority: 'low' },
        { name: 'Home', targetValue: 5000000, years: 5, priority: 'high' },
      ],
      monthlyContribution: 25000,
    });
    expect(result.totalPortfolioValue).toBe(1000000);
    expect(result.allocation).toHaveLength(3);
    expect(result.weightedExpectedReturnPct).toBeCloseTo(9.3, 5);
    expect(result.goals[0]?.name).toBe('Home');
    expect(result.goals[0]?.requiredMonthlyContribution).toBeGreaterThan(0);
    expect(result.actions.some((action) => action.includes('high-priority'))).toBe(true);
  });

  it('does not fabricate a return when no holding-level return is supplied', () => {
    const result = buildCrossAssetIntelligence({
      holdings: [{ symbol: 'CASH', assetClass: 'cash', marketValue: 100000 }],
      goals: [{ name: 'Goal', targetValue: 100000, years: 1 }],
    });
    expect(result.weightedExpectedReturnPct).toBeUndefined();
    expect(result.warnings.some((warning) => warning.includes('diversification'))).toBe(true);
  });

  it('rejects invalid contribution assumptions', () => {
    expect(() => buildCrossAssetIntelligence({
      holdings: [],
      goals: [],
      monthlyContribution: -1,
    })).toThrow('Monthly contribution must be non-negative');
  });
});
