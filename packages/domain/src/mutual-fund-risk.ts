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

/** Computes return, volatility and drawdown statistics strictly from observed NAV history. */
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
  let runningPeakDate = firstTime;
  let episodeStartDate: number | null = null;
  let episodeMinDrawdown = 0;
  let episodeMinDate: number | null = null;
  let longestDrawdownDays = 0;

  let maxDrawdown = 0;
  let maxDrawdownStart: number | null = null;
  let maxDrawdownDate: number | null = null;
  let maxDrawdownRecovery: number | null = null;
  let maxDrawdownRecoveryDays = 0;
  let bestDailyReturn = Number.NEGATIVE_INFINITY;
  let worstDailyReturn = Number.POSITIVE_INFINITY;

  const closeEpisode = (recoveryDate: number) => {
    if (episodeStartDate === null) return;
    const durationDays = (recoveryDate - episodeStartDate) / DAY_MS;
    longestDrawdownDays = Math.max(longestDrawdownDays, durationDays);
    if (episodeMinDrawdown < maxDrawdown) {
      maxDrawdown = episodeMinDrawdown;
      maxDrawdownStart = episodeStartDate;
      maxDrawdownDate = episodeMinDate;
      maxDrawdownRecovery = recoveryDate;
      maxDrawdownRecoveryDays = durationDays;
    }
    episodeStartDate = null;
    episodeMinDrawdown = 0;
    episodeMinDate = null;
  };

  for (let i = 1; i < data.length; i += 1) {
    const previous = data[i - 1]!;
    const current = data[i]!;
    const currentTime = Date.parse(current.timestamp);
    const dailyReturn = (current.nav / previous.nav - 1) * 100;
    if (Number.isFinite(dailyReturn)) {
      dailyReturns.push(dailyReturn);
      bestDailyReturn = Math.max(bestDailyReturn, dailyReturn);
      worstDailyReturn = Math.min(worstDailyReturn, dailyReturn);
    }

    if (current.nav >= runningPeak) {
      if (episodeStartDate !== null) closeEpisode(currentTime);
      runningPeak = current.nav;
      runningPeakDate = currentTime;
      continue;
    }

    const drawdown = (current.nav / runningPeak - 1) * 100;
    if (episodeStartDate === null) {
      episodeStartDate = runningPeakDate;
      episodeMinDrawdown = drawdown;
      episodeMinDate = currentTime;
    } else if (drawdown < episodeMinDrawdown) {
      episodeMinDrawdown = drawdown;
      episodeMinDate = currentTime;
    }
  }

  if (episodeStartDate !== null) {
    const durationDays = (lastTime - episodeStartDate) / DAY_MS;
    longestDrawdownDays = Math.max(longestDrawdownDays, durationDays);
    if (episodeMinDrawdown < maxDrawdown) {
      maxDrawdown = episodeMinDrawdown;
      maxDrawdownStart = episodeStartDate;
      maxDrawdownDate = episodeMinDate;
      maxDrawdownRecovery = null;
      maxDrawdownRecoveryDays = durationDays;
    }
  }

  return {
    startDate: first.timestamp,
    endDate: last.timestamp,
    startNav: first.nav,
    endNav: last.nav,
    periodReturnPct: ((last.nav / first.nav) - 1) * 100,
    cagrPct: cagr(first.nav, last.nav, years),
    annualizedVolatilityPct: standardDeviation(dailyReturns) * Math.sqrt(252),
    maxDrawdownPct: maxDrawdown,
    maxDrawdownStartDate: maxDrawdownStart === null ? null : new Date(maxDrawdownStart).toISOString(),
    maxDrawdownDate: maxDrawdownDate === null ? null : new Date(maxDrawdownDate).toISOString(),
    maxDrawdownRecoveryDate: maxDrawdownRecovery === null ? null : new Date(maxDrawdownRecovery).toISOString(),
    maxDrawdownRecoveryDays,
    longestDrawdownDays,
    bestDailyReturnPct: Number.isFinite(bestDailyReturn) ? bestDailyReturn : 0,
    worstDailyReturnPct: Number.isFinite(worstDailyReturn) ? worstDailyReturn : 0,
    observations: data.length,
  };
}
