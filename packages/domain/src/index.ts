export type ProjectionScenario = 'conservative' | 'base' | 'optimistic';

export interface Projection { scenario: ProjectionScenario; annualReturn: number; futureValue: number; }

/** Monthly SIP future value using an effective monthly rate. */
export function sipFutureValue(monthlyInvestment: number, annualReturnPct: number, years: number): number {
  if (monthlyInvestment < 0 || years < 0) throw new Error('Investment and years must be non-negative');
  const months = Math.round(years * 12); if (months === 0) return 0;
  const monthlyRate = annualReturnPct / 100 / 12; if (monthlyRate === 0) return monthlyInvestment * months;
  return monthlyInvestment * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate);
}
export function lumpsumFutureValue(principal: number, annualReturnPct: number, years: number): number {
  if (principal < 0 || years < 0) throw new Error('Principal and years must be non-negative');
  return principal * Math.pow(1 + annualReturnPct / 100, years);
}
export function requiredLumpsum(target: number, annualReturnPct: number, years: number): number {
  if (target < 0 || years < 0) throw new Error('Target and years must be non-negative');
  if (years === 0) return target; return target / Math.pow(1 + annualReturnPct / 100, years);
}
export function projectLumpsum(principal: number, years: number, assumptions: Record<ProjectionScenario, number>): Projection[] {
  return (Object.entries(assumptions) as [ProjectionScenario, number][]).map(([scenario, annualReturn]) => ({ scenario, annualReturn, futureValue: lumpsumFutureValue(principal, annualReturn, years) }));
}
export * from './investment-lab';
export * from './mutual-fund-analytics';
export * from './mutual-fund-risk';
export * from './mutual-fund-simulator';
export * from './mutual-fund-comparison';
export * from './stock-intelligence';
export * from './stock-technical';
export * from './financial-intelligence';
export * from './scenario-engine';
export * from './valuation-intelligence';
