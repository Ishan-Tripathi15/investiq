export type LabScenario = 'conservative' | 'base' | 'optimistic';

export interface YearlyProjection {
  year: number;
  contribution: number;
  invested: number;
  corpus: number;
  returns: number;
}

export interface SipPlan {
  monthlyInvestment: number;
  annualReturnPct: number;
  years: number;
  annualStepUpPct: number;
  months: number;
  totalInvested: number;
  finalValue: number;
  profit: number;
  yearly: YearlyProjection[];
}

export interface LabScenarioResult {
  scenario: LabScenario;
  annualReturnPct: number;
  value: number;
}

function assertNonNegative(name: string, value: number) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be non-negative`);
}

export function calculateSipPlan(
  monthlyInvestment: number,
  annualReturnPct: number,
  years: number,
  annualStepUpPct = 0,
): SipPlan {
  assertNonNegative('Monthly investment', monthlyInvestment);
  assertNonNegative('Years', years);
  assertNonNegative('Annual step-up', annualStepUpPct);
  if (!Number.isFinite(annualReturnPct) || annualReturnPct <= -100) throw new Error('Annual return must be greater than -100%');

  const months = Math.round(years * 12);
  const monthlyRate = Math.pow(1 + annualReturnPct / 100, 1 / 12) - 1;
  let corpus = 0;
  let contribution = monthlyInvestment;
  let totalInvested = 0;
  const yearly: YearlyProjection[] = [];

  for (let month = 1; month <= months; month += 1) {
    corpus = corpus * (1 + monthlyRate) + contribution;
    totalInvested += contribution;
    if (month % 12 === 0 || month === months) {
      const year = Math.ceil(month / 12);
      yearly.push({ year, contribution: contribution * (month % 12 === 0 ? 12 : month % 12), invested: totalInvested, corpus, returns: corpus - totalInvested });
    }
    if (month % 12 === 0) contribution *= 1 + annualStepUpPct / 100;
  }

  return { monthlyInvestment, annualReturnPct, years, annualStepUpPct, months, totalInvested, finalValue: corpus, profit: corpus - totalInvested, yearly };
}

export function calculateLumpsumPlan(principal: number, years: number, assumptions: Record<LabScenario, number>): LabScenarioResult[] {
  assertNonNegative('Principal', principal);
  assertNonNegative('Years', years);
  return (Object.entries(assumptions) as [LabScenario, number][]).map(([scenario, annualReturnPct]) => {
    if (!Number.isFinite(annualReturnPct) || annualReturnPct <= -100) throw new Error('Annual return must be greater than -100%');
    return { scenario, annualReturnPct, value: principal * Math.pow(1 + annualReturnPct / 100, years) };
  });
}

export function calculateReverseLumpsumPlan(target: number, years: number, assumptions: Record<LabScenario, number>): LabScenarioResult[] {
  assertNonNegative('Target', target);
  assertNonNegative('Years', years);
  return (Object.entries(assumptions) as [LabScenario, number][]).map(([scenario, annualReturnPct]) => {
    if (!Number.isFinite(annualReturnPct) || annualReturnPct <= -100) throw new Error('Annual return must be greater than -100%');
    const value = years === 0 ? target : target / Math.pow(1 + annualReturnPct / 100, years);
    return { scenario, annualReturnPct, value };
  });
}
