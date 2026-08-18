export interface NavPoint {
  timestamp: string;
  nav: number;
}

export interface RollingReturn {
  windowYears: number;
  observations: number;
  positivePct: number;
  medianCagrPct: number;
  bestCagrPct: number;
  worstCagrPct: number;
}

export interface SipBacktestResult {
  monthlyInvestment: number;
  totalInvested: number;
  units: number;
  endingValue: number;
  profit: number;
  absoluteReturnPct: number;
  annualizedReturnPct: number;
  startDate: string;
  endDate: string;
  contributions: number;
}

function ordered(points: NavPoint[]): NavPoint[] {
  return points
    .filter((point) => Number.isFinite(point.nav) && point.nav > 0 && Number.isFinite(new Date(point.timestamp).getTime()))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const data = [...values].sort((a, b) => a - b);
  const middle = Math.floor(data.length / 2);
  return data.length % 2 ? data[middle]! : (data[middle - 1]! + data[middle]!) / 2;
}

function cagr(start: number, end: number, years: number): number {
  if (start <= 0 || end <= 0 || years <= 0) return 0;
  return (Math.pow(end / start, 1 / years) - 1) * 100;
}

export function calculateRollingReturns(points: NavPoint[], windowsYears: number[] = [1, 3, 5]): RollingReturn[] {
  const data = ordered(points);
  return windowsYears.filter((years) => years > 0).map((windowYears) => {
    const windowMs = windowYears * 365.25 * 24 * 60 * 60 * 1000;
    const returns: number[] = [];
    for (let i = 0; i < data.length; i += 1) {
      const startTime = new Date(data[i]!.timestamp).getTime();
      const target = startTime + windowMs;
      let low = i + 1;
      let high = data.length - 1;
      let match = -1;
      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        if (new Date(data[middle]!.timestamp).getTime() >= target) {
          match = middle;
          high = middle - 1;
        } else low = middle + 1;
      }
      if (match >= 0) {
        const actualYears = (new Date(data[match]!.timestamp).getTime() - startTime) / (365.25 * 24 * 60 * 60 * 1000);
        returns.push(cagr(data[i]!.nav, data[match]!.nav, actualYears));
      }
    }
    return {
      windowYears,
      observations: returns.length,
      positivePct: returns.length ? (returns.filter((value) => value > 0).length / returns.length) * 100 : 0,
      medianCagrPct: median(returns),
      bestCagrPct: returns.length ? Math.max(...returns) : 0,
      worstCagrPct: returns.length ? Math.min(...returns) : 0,
    };
  });
}

/**
 * Backtests a fixed monthly SIP against the supplied NAV history.
 * The contribution is invested at the first available NAV on/after each monthly anniversary.
 */
export function backtestMonthlySip(points: NavPoint[], monthlyInvestment: number, months?: number): SipBacktestResult {
  if (!Number.isFinite(monthlyInvestment) || monthlyInvestment <= 0) throw new Error('Monthly investment must be positive');
  const data = ordered(points);
  if (data.length < 2) throw new Error('At least two NAV observations are required');

  const start = new Date(data[0]!.timestamp);
  const maxMonths = Math.floor((new Date(data[data.length - 1]!.timestamp).getTime() - start.getTime()) / (30.4375 * 24 * 60 * 60 * 1000));
  const contributionMonths = Math.min(Math.max(months ?? maxMonths, 1), maxMonths + 1);
  let units = 0;
  let totalInvested = 0;
  let cursor = 0;
  let contributionDate = new Date(start);

  for (let month = 0; month < contributionMonths; month += 1) {
    while (cursor < data.length - 1 && new Date(data[cursor]!.timestamp).getTime() < contributionDate.getTime()) cursor += 1;
    if (new Date(data[cursor]!.timestamp).getTime() < contributionDate.getTime()) break;
    units += monthlyInvestment / data[cursor]!.nav;
    totalInvested += monthlyInvestment;
    contributionDate = new Date(start);
    contributionDate.setUTCMonth(start.getUTCMonth() + month + 1);
  }

  const last = data[data.length - 1]!;
  const endingValue = units * last.nav;
  const years = Math.max(1 / 12, (new Date(last.timestamp).getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  const annualizedReturnPct = cagr(totalInvested, endingValue, years);
  return {
    monthlyInvestment,
    totalInvested,
    units,
    endingValue,
    profit: endingValue - totalInvested,
    absoluteReturnPct: totalInvested ? ((endingValue / totalInvested) - 1) * 100 : 0,
    annualizedReturnPct,
    startDate: data[0]!.timestamp,
    endDate: last.timestamp,
    contributions: Math.round(totalInvested / monthlyInvestment),
  };
}
