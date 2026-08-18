export type Scenario = 'conservative' | 'base' | 'optimistic';

export interface Projection {
  invested: number;
  value: number;
  profit: number;
  annualRate: number;
  years: number;
}

export interface ScenarioProjection extends Projection {
  scenario: Scenario;
}

const SCENARIO_RATES: Record<Scenario, number> = {
  conservative: 8,
  base: 12,
  optimistic: 15,
};

function monthlyRate(annualRate: number): number {
  return Math.pow(1 + annualRate / 100, 1 / 12) - 1;
}

export function projectLumpsum(principal: number, annualRate: number, years: number): Projection {
  if (principal < 0 || years < 0) throw new Error('Principal and years must be non-negative');
  const value = principal * Math.pow(1 + annualRate / 100, years);
  return { invested: principal, value, profit: value - principal, annualRate, years };
}

export function projectSip(monthlyInvestment: number, annualRate: number, years: number, annualStepUp = 0): Projection {
  if (monthlyInvestment < 0 || years < 0 || annualStepUp < 0) throw new Error('Inputs must be non-negative');
  const months = Math.round(years * 12);
  const r = monthlyRate(annualRate);
  let corpus = 0;
  let invested = 0;
  let contribution = monthlyInvestment;

  for (let month = 1; month <= months; month += 1) {
    corpus = corpus * (1 + r) + contribution;
    invested += contribution;
    if (month % 12 === 0) contribution *= 1 + annualStepUp / 100;
  }

  return { invested, value: corpus, profit: corpus - invested, annualRate, years };
}

export function reverseLumpsumGoal(target: number, annualRate: number, years: number): number {
  if (target < 0 || years < 0) throw new Error('Target and years must be non-negative');
  return target / Math.pow(1 + annualRate / 100, years);
}

export function scenarioLumpsum(principal: number, years: number): ScenarioProjection[] {
  return (Object.keys(SCENARIO_RATES) as Scenario[]).map((scenario) => ({
    scenario,
    ...projectLumpsum(principal, SCENARIO_RATES[scenario], years),
  }));
}

export function scenarioSip(monthlyInvestment: number, years: number, annualStepUp = 0): ScenarioProjection[] {
  return (Object.keys(SCENARIO_RATES) as Scenario[]).map((scenario) => ({
    scenario,
    ...projectSip(monthlyInvestment, SCENARIO_RATES[scenario], years, annualStepUp),
  }));
}

export const scenarioRates = SCENARIO_RATES;
