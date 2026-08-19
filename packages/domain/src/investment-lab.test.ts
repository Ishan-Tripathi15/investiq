import { describe, expect, it } from 'vitest';
import { calculateLumpsumPlan, calculateReverseLumpsumPlan, calculateSipPlan } from './investment-lab';

describe('investment lab', () => {
  it('calculates a SIP with exact annual step-up contributions', () => {
    const plan = calculateSipPlan(10000, 12, 2, 10);
    expect(plan.months).toBe(24);
    expect(plan.totalInvested).toBe(252000);
    expect(plan.yearly).toHaveLength(2);
    expect(plan.yearly[0]?.invested).toBe(120000);
    expect(plan.yearly[1]?.invested).toBe(252000);
    expect(plan.finalValue).toBeGreaterThan(plan.totalInvested);
  });

  it('calculates lumpsum scenarios', () => {
    const result = calculateLumpsumPlan(100000, 10, { conservative: 8, base: 12, optimistic: 15 });
    expect(result[0]?.value).toBeCloseTo(108000, 2);
    expect(result[1]?.value).toBeCloseTo(112000, 2);
    expect(result[2]?.value).toBeCloseTo(115000, 2);
  });

  it('calculates reverse goal capital', () => {
    const result = calculateReverseLumpsumPlan(1000000, 5, { conservative: 8, base: 12, optimistic: 15 });
    expect(result[1]?.value).toBeCloseTo(1000000 / Math.pow(1.12, 5), 2);
    expect(result[0]!.value).toBeGreaterThan(result[1]!.value);
    expect(result[1]!.value).toBeGreaterThan(result[2]!.value);
  });
});
