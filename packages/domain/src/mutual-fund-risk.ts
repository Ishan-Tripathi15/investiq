export interface FundNavPoint {
  timestamp: string;
  nav: number;
}

export interface FundHistoricalStats {
  startDate: string;
  endDate: string;
  startNav: number;
  endNav: number;
  periodReturnPct: number;
  cagrPct: number;
  annualizedVolatilityPct: number;
  maxDrawdownPct: number;
  maxDrawdownStartDate: string | null;
  maxDrawdownDate: string | null;
  maxDrawdownRecoveryDate: string | null;
  maxDrawdownRecoveryDays: number;
  longestDrawdownDays: number;
  bestDailyReturnPct: number;
  worstDailyReturnPct: number;
  observations: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_MS = 365.25 * DAY_MS;

function ordered(points: FundNavPoint[]): FundNavPoint[] {
  return points
    .filter((point) => Number.isFinite(point.nav) && point.nav > 0 && Number.isFinite(Date.parse(point.timestamp)))
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

function mean(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const average = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
  return Math.sqrt(Math.max(variance, 0));
}

function cagr(startNav: number, endNav: number, years: number): number {
  if (startNav <= 0 || endNav <= 0 || years <= 0) return 0;
  return (Math.pow(endNav / startNav, 1 / years) - 1) * 100;
}

/**
 * Computes risk and return statistics strictly from the supplied observed NAV series.
 * Volatility uses annualized standard deviation of consecutive observed NAV returns.
 * Drawdown is measured from each running NAV peak and recovery requires a new NAV high.
 */
export function calculateFundHistoricalStats(points: FundNavPoint[]): FundHistoricalStats | null {
  const data = ordered(points);
  if (data.length < 2) return null;

  const first = data[0]!;
  const last = data[data.length - 1]!;
  const firstTime = Date.parse(first.timestamp);
  const lastTime = Date.parse(last.timestamp);
  const years = (lastTime - firstTime) / YEAR_MS;
  const dailyReturns: number[] = [];

  let runningPeak = first.nav;
  let peakDate = firstTime;
  let drawdownStartDate: number | null = null;
  let currentDrawdownStartDate: number | null = null;
  let currentDrawdownMinDate: number | null = null;
  let currentDrawdownMin = 0;
  let maxDrawdown = 0;
  let maxDrawdownStart: number | null = null;
  let maxDrawdownDate: number | null = null;
  let maxDrawdownRecovery: number | null = null;
  let longestDrawdownDays = 0;
  let maxRecoveryDays = 0;
  let bestDailyReturn = Number.NEGATIVE_INFINITY;
  let worstDailyReturn = Number.POSITIVE_INFINITY;

  for (let i = 1; i < data.length; i += 1) {
    const previous = data[i - 1]!;
    const current = data[i]!;
    const previousTime = Date.parse(previous.timestamp);
    const currentTime = Date.parse(current.timestamp);
    const dailyReturn = (current.nav / previous.nav - 1) * 100;
    if (Number.isFinite(dailyReturn)) {
      dailyReturns.push(dailyReturn);
      bestDailyReturn = Math.max(bestDailyReturn, dailyReturn);
      worstDailyReturn = Math.min(worstDailyReturn, dailyReturn);
    }

    if (current.nav > runningPeak) {
      if (currentDrawdownStartDate !== null) {
        const durationDays = (currentTime - currentDrawdownStartDate) / DAY_MS;
        longestDrawdownDays = Math.max(longestDrawdownDays, durationDays);
        const recoveryDays = (currentTime - peakDate) / DAY_MS;
        maxRecoveryDays = Math.max(maxRecoveryDays, recoveryDays);
        if (maxDrawdownRecovery === null || Math.abs(currentDrawdownMin) >= Math.abs(maxDrawdown)) {
          maxDrawdownRecovery = currentTime;
        }
      }
      runningPeak = current.nav;
      peakDate = currentTime;
      currentDrawdownStartDate = null;
      currentDrawdownMin = 0;
      currentDrawdownMinDate = null;
      continue;
    }

    const drawdown = (current.nav / runningPeak - 1) * 100;
    if (currentDrawdownStartDate === null && drawdown < 0) {
      currentDrawdownStartDate = peakDate;
      drawdownStartDate = peakDate;
    }
    if (drawdown < currentDrawdownMin) {
      currentDrawdownMin = drawdown;
      currentDrawdownMinDate = currentTime;
    }
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownStart = peakDate;
      maxDrawdownDate = currentTime;
      maxDrawdownRecovery = null;
    }

    if (currentTime < previousTime) {
      runningPeak = current.nav;
      peakDate = currentTime;
    }
  }

  if (currentDrawdownStartDate !== null) {
    longestDrawdownDays = Math.max(longestDrawdownDays, (lastTime - currentDrawdownStartDate) / DAY_MS);
  }

  if (maxDrawdownRecovery === null && maxDrawdownDate !== null) {
    maxRecoveryDays = Math.max(maxRecoveryDays, (lastTime - maxDrawdownStart!) / DAY_MS);
  }

  const annualizedVolatilityPct = standardDeviation(dailyReturns) * Math.sqrt(252);
  const maxDrawdownStartDate = maxDrawdownStart !== null ? new Date(maxDrawdownStart).toISOString() : null;
  const maxDrawdownDateIso = maxDrawdownDate !== null ? new Date(maxDrawdownDate).toISOString() : null;
  const recoveryDateIso = maxDrawdownRecovery !== null ? new Date(maxDrawdownRecovery).toISOString() : null;

  return {
    startDate: first.timestamp,
    endDate: last.timestamp,
    startNav: first.nav,
    endNav: last.nav,
    periodReturnPct: ((last.nav / first.nav) - 1) * 100,
    cagrPct: cagr(first.nav, last.nav, years),
    annualizedVolatilityPct,
    maxDrawdownPct: maxDrawdown,
    maxDrawdownStartDate,
    maxDrawdownDate: maxDrawdownDateIso,
    maxDrawdownRecoveryDate: recoveryDateIso,
    maxDrawdownRecoveryDays: maxRecoveryDays,
    longestDrawdownDays,
    bestDailyReturnPct: Number.isFinite(bestDailyReturn) ? bestDailyReturn : 0,
    worstDailyReturnPct: Number.isFinite(worstDailyReturn) ? worstDailyReturn : 0,
    observations: data.length,
  };
}
