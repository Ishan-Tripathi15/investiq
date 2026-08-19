export interface FundInvestmentSimulation {
  initialInvestment: number;
  startDate: string;
  endDate: string;
  startNav: number;
  endNav: number;
  units: number;
  endingValue: number;
  profit: number;
  absoluteReturnPct: number;
  annualizedReturnPct: number;
}

export interface FundGoalScenario {
  label: 'conservative' | 'base' | 'optimistic';
  annualReturnPct: number;
  projectedValue: number;
  requiredInitialInvestment: number;
  targetAchievable: boolean;
}

export interface FundGoalAnalysis {
  target: number;
  years: number;
  scenarios: FundGoalScenario[];
}

type Point = { timestamp: string; nav: number };
const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

function ordered(points: Point[]): Point[] {
  return points.filter((p) => Number.isFinite(p.nav) && p.nav > 0 && Number.isFinite(Date.parse(p.timestamp))).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

function xnpv(rate: number, cashflows: { date: number; amount: number }[], base: number): number {
  return cashflows.reduce((sum, flow) => sum + flow.amount / Math.pow(1 + rate, (flow.date - base) / YEAR_MS), 0);
}

function xirr(cashflows: { date: number; amount: number }[]): number {
  if (cashflows.length < 2 || !cashflows.some((f) => f.amount < 0) || !cashflows.some((f) => f.amount > 0)) return 0;
  let low = -0.9999;
  let high = 10;
  let lowValue = xnpv(low, cashflows, cashflows[0]!.date);
  let highValue = xnpv(high, cashflows, cashflows[0]!.date);
  if (!Number.isFinite(lowValue) || !Number.isFinite(highValue) || lowValue * highValue > 0) return 0;
  for (let i = 0; i < 120; i += 1) {
    const mid = (low + high) / 2;
    const value = xnpv(mid, cashflows, cashflows[0]!.date);
    if (Math.abs(value) < 1e-9) return mid * 100;
    if (lowValue * value <= 0) { high = mid; highValue = value; } else { low = mid; lowValue = value; }
  }
  return ((low + high) / 2) * 100;
}

/** Simulates a one-time investment strictly against observed NAV history. */
export function simulateHistoricalLumpsum(points: Point[], initialInvestment: number): FundInvestmentSimulation | null {
  if (!Number.isFinite(initialInvestment) || initialInvestment <= 0) throw new Error('Initial investment must be positive');
  const data = ordered(points);
  if (data.length < 2) return null;
  const first = data[0]!;
  const last = data[data.length - 1]!;
  const units = initialInvestment / first.nav;
  const endingValue = units * last.nav;
  const years = (Date.parse(last.timestamp) - Date.parse(first.timestamp)) / YEAR_MS;
  return {
    initialInvestment,
    startDate: first.timestamp,
    endDate: last.timestamp,
    startNav: first.nav,
    endNav: last.nav,
    units,
    endingValue,
    profit: endingValue - initialInvestment,
    absoluteReturnPct: ((endingValue / initialInvestment) - 1) * 100,
    annualizedReturnPct: years > 0 ? (Math.pow(endingValue / initialInvestment, 1 / years) - 1) * 100 : 0,
  };
}

/** Compares a historical lumpsum against a fixed investment date and horizon available in the supplied series. */
export function simulateHistoricalLumpsumAt(points: Point[], initialInvestment: number, startTimestamp: string, horizonYears?: number): FundInvestmentSimulation | null {
  if (!Number.isFinite(initialInvestment) || initialInvestment <= 0) throw new Error('Initial investment must be positive');
  const data = ordered(points);
  const startTime = Date.parse(startTimestamp);
  if (!Number.isFinite(startTime) || data.length < 2) return null;
  const startIndex = data.findIndex((p) => Date.parse(p.timestamp) >= startTime);
  if (startIndex < 0) return null;
  const target = horizonYears && horizonYears > 0 ? startTime + horizonYears * YEAR_MS : Number.POSITIVE_INFINITY;
  let endIndex = data.length - 1;
  if (Number.isFinite(target)) {
    endIndex = data.findIndex((p, i) => i >= startIndex && Date.parse(p.timestamp) >= target);
    if (endIndex < 0) endIndex = data.length - 1;
  }
  const start = data[startIndex]!;
  const end = data[endIndex]!;
  const units = initialInvestment / start.nav;
  const endingValue = units * end.nav;
  const years = (Date.parse(end.timestamp) - Date.parse(start.timestamp)) / YEAR_MS;
  return { initialInvestment, startDate: start.timestamp, endDate: end.timestamp, startNav: start.nav, endNav: end.nav, units, endingValue, profit: endingValue - initialInvestment, absoluteReturnPct: ((endingValue / initialInvestment) - 1) * 100, annualizedReturnPct: years > 0 ? (Math.pow(endingValue / initialInvestment, 1 / years) - 1) * 100 : 0 };
}

export function analyzeFundGoal(target: number, years: number, assumptions: Record<FundGoalScenario['label'], number>): FundGoalAnalysis {
  if (!Number.isFinite(target) || target < 0) throw new Error('Target must be non-negative');
  if (!Number.isFinite(years) || years < 0) throw new Error('Years must be non-negative');
  const scenarios = (Object.entries(assumptions) as [FundGoalScenario['label'], number][]).map(([label, annualReturnPct]) => {
    if (!Number.isFinite(annualReturnPct) || annualReturnPct <= -100) throw new Error('Annual return must be greater than -100%');
    const factor = Math.pow(1 + annualReturnPct / 100, years);
    return { label, annualReturnPct, projectedValue: target * factor, requiredInitialInvestment: years === 0 ? target : target / factor, targetAchievable: factor >= 1 };
  });
  return { target, years, scenarios };
}
