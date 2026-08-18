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

interface Cashflow {
  date: number;
  amount: number;
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

function xnpv(rate: number, cashflows: Cashflow[], baseDate: number): number {
  if (rate <= -1) return Number.POSITIVE_INFINITY;
  return cashflows.reduce((sum, cashflow) => {
    const years = (cashflow.date - baseDate) / (365.25 * 24 * 60 * 60 * 1000);
    return sum + cashflow.amount / Math.pow(1 + rate, years);
  }, 0);
}

/** Calculates an annualized money-weighted return for irregularly dated cashflows. */
function xirr(cashflows: Cashflow[]): number {
  if (cashflows.length < 2) return 0;
  const hasNegative = cashflows.some((flow) => flow.amount < 0);
  const hasPositive = cashflows.some((flow) => flow.amount > 0);
  if (!hasNegative || !hasPositive) return 0;

  const baseDate = cashflows[0]!.date;
  const lowerRate = -0.9999;
  const upperRate = 10;
  let low = lowerRate;
  let high = upperRate;
  let lowValue = xnpv(low, cashflows, baseDate);
  let highValue = xnpv(high, cashflows, baseDate);

  if (!Number.isFinite(lowValue) || !Number.isFinite(highValue) || lowValue * highValue > 0) return 0;

  for (let i = 0; i < 100; i += 1) {
    const mid = (low + high) / 2;
    const value = xnpv(mid, cashflows, baseDate);
    if (!Number.isFinite(value)) {
      low = mid;
      continue;
    }
    if (Math.abs(value) < 1e-8) return mid * 100;
    if (lowValue * value <= 0) {
      high = mid;
      highValue = value;
    } else {
      low = mid;
      lowValue = value;
    }
  }

  return ((low + high) / 2) * 100;
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
 * Annualized return is a money-weighted XIRR using the actual contribution dates and final value.
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
  const cashflows: Cashflow[] = [];

  for (let month = 0; month < contributionMonths; month += 1) {
    while (cursor < data.length - 1 && new Date(data[cursor]!.timestamp).getTime() < contributionDate.getTime()) cursor += 1;
    if (new Date(data[cursor]!.timestamp).getTime() < contributionDate.getTime()) break;
    const investmentDate = new Date(data[cursor]!.timestamp).getTime();
    units += monthlyInvestment / data[cursor]!.nav;
    totalInvested += monthlyInvestment;
    cashflows.push({ date: investmentDate, amount: -monthlyInvestment });
    contributionDate = new Date(start);
    contributionDate.setUTCMonth(start.getUTCMonth() + month + 1);
  }

  const last = data[data.length - 1]!;
  const endingValue = units * last.nav;
  cashflows.push({ date: new Date(last.timestamp).getTime(), amount: endingValue });
  const annualizedReturnPct = xirr(cashflows);

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
