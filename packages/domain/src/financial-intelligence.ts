export interface FinancialPeriodInput {
  fiscalDate: string;
  revenue?: number;
  ebitda?: number;
  netIncome?: number;
  eps?: number;
  operatingCashFlow?: number;
  freeCashFlow?: number;
  totalDebt?: number;
  totalCash?: number;
  roe?: number;
  roce?: number;
  grossMarginPct?: number;
  operatingMarginPct?: number;
  netMarginPct?: number;
}

export interface FinancialQualityScore {
  score: number;
  label: 'weak' | 'developing' | 'healthy' | 'strong';
  components: { profitability: number; growth: number; cashFlow: number; balanceSheet: number; consistency: number };
  evidence: string[];
}

export interface FinancialTrend {
  metric: string;
  first?: number;
  latest?: number;
  cagrPct?: number;
  direction: 'up' | 'down' | 'flat' | 'unavailable';
}

export interface ValuationSnapshot {
  pe?: number;
  forwardPe?: number;
  priceToBook?: number;
  priceToSales?: number;
  evToEbitda?: number;
  evToRevenue?: number;
}

export function cagr(first: number | undefined, last: number | undefined, years: number): number | undefined {
  if (first == null || last == null || years <= 0 || first <= 0 || last < 0) return undefined;
  return (Math.pow(last / first, 1 / years) - 1) * 100;
}

function elapsedYears(firstDate: string, lastDate: string): number {
  return Math.max(1, (Date.parse(lastDate) - Date.parse(firstDate)) / 31557600000);
}

function scoreGrowth(periods: FinancialPeriodInput[]): number {
  const valid = periods.filter((p) => p.revenue != null && p.revenue > 0);
  if (valid.length < 2) return 0;
  const first = valid[0];
  const last = valid[valid.length - 1];
  if (!first || !last || first.revenue == null || last.revenue == null) return 0;
  const growth = cagr(first.revenue, last.revenue, elapsedYears(first.fiscalDate, last.fiscalDate));
  if (growth == null) return 0;
  return Math.max(0, Math.min(25, 12.5 + growth));
}

export function financialTrends(periods: FinancialPeriodInput[]): FinancialTrend[] {
  const sorted = [...periods].sort((a, b) => a.fiscalDate.localeCompare(b.fiscalDate));
  const metrics: Array<[string, (p: FinancialPeriodInput) => number | undefined]> = [
    ['Revenue', (p) => p.revenue], ['EBITDA', (p) => p.ebitda], ['Net income', (p) => p.netIncome],
    ['EPS', (p) => p.eps], ['Free cash flow', (p) => p.freeCashFlow],
  ];
  return metrics.map(([metric, get]): FinancialTrend => {
    const valid = sorted.filter((p) => get(p) != null);
    if (valid.length < 2) return { metric, direction: 'unavailable' };
    const firstPeriod = valid[0];
    const latestPeriod = valid[valid.length - 1];
    if (!firstPeriod || !latestPeriod) return { metric, direction: 'unavailable' };
    const first = get(firstPeriod);
    const latest = get(latestPeriod);
    if (first == null || latest == null) return { metric, direction: 'unavailable' };
    const trend = latest - first;
    const result: FinancialTrend = {
      metric,
      first,
      latest,
      direction: Math.abs(trend) < Math.abs(first || 1) * 0.03 ? 'flat' : trend > 0 ? 'up' : 'down',
    };
    const growth = cagr(first, latest, elapsedYears(firstPeriod.fiscalDate, latestPeriod.fiscalDate));
    if (growth != null) result.cagrPct = growth;
    return result;
  });
}

export function calculateFinancialQuality(periods: FinancialPeriodInput[]): FinancialQualityScore {
  const sorted = [...periods].sort((a, b) => a.fiscalDate.localeCompare(b.fiscalDate));
  if (!sorted.length) return { score: 0, label: 'weak', components: { profitability: 0, growth: 0, cashFlow: 0, balanceSheet: 0, consistency: 0 }, evidence: ['No verified financial periods are available.'] };
  const latest = sorted[sorted.length - 1];
  if (!latest) return { score: 0, label: 'weak', components: { profitability: 0, growth: 0, cashFlow: 0, balanceSheet: 0, consistency: 0 }, evidence: ['No verified financial periods are available.'] };
  const profitability = Math.max(0, Math.min(25, (latest.netMarginPct ?? 0) * 1.25 + (latest.roe ?? 0) * 0.5));
  const growth = scoreGrowth(sorted);
  const cashFlow = latest.freeCashFlow != null && latest.netIncome != null
    ? Math.max(0, Math.min(20, latest.freeCashFlow >= 0 ? 12 + (latest.freeCashFlow / Math.max(1, Math.abs(latest.netIncome))) * 8 : 4)) : 0;
  const leverage = latest.totalDebt != null && latest.totalCash != null
    ? latest.totalDebt <= latest.totalCash ? 15 : Math.max(0, 15 - ((latest.totalDebt - latest.totalCash) / Math.max(1, latest.totalCash)) * 5) : 7.5;
  const consistencyRows = sorted.filter((p) => p.netIncome != null);
  const profitableYears = consistencyRows.filter((p) => (p.netIncome ?? 0) > 0).length;
  const consistency = consistencyRows.length ? (profitableYears / consistencyRows.length) * 15 : 0;
  const raw = Math.round(Math.max(0, Math.min(100, profitability + growth + cashFlow + leverage + consistency)));
  const label = raw >= 80 ? 'strong' : raw >= 65 ? 'healthy' : raw >= 45 ? 'developing' : 'weak';
  const evidence: string[] = [];
  if (latest.netMarginPct != null) evidence.push(`Latest net margin: ${latest.netMarginPct.toFixed(1)}%.`);
  if (latest.roe != null) evidence.push(`Latest ROE: ${latest.roe.toFixed(1)}%.`);
  if (latest.freeCashFlow != null) evidence.push(`Latest reported free cash flow: ${latest.freeCashFlow >= 0 ? 'positive' : 'negative'}.`);
  if (latest.totalDebt != null && latest.totalCash != null) evidence.push(`Debt vs cash: ${latest.totalDebt <= latest.totalCash ? 'cash covers reported debt' : 'reported debt exceeds cash'}.`);
  evidence.push(`${profitableYears}/${consistencyRows.length} available periods show positive net income.`);
  return { score: raw, label, components: { profitability: Math.round(profitability), growth: Math.round(growth), cashFlow: Math.round(cashFlow), balanceSheet: Math.round(leverage), consistency: Math.round(consistency) }, evidence };
}

export function valuationFlags(v: ValuationSnapshot): string[] {
  const flags: string[] = [];
  if (v.pe != null && v.pe > 35) flags.push('High trailing P/E');
  if (v.pe != null && v.pe > 0 && v.pe < 12) flags.push('Low trailing P/E');
  if (v.priceToBook != null && v.priceToBook > 6) flags.push('High price-to-book');
  if (v.evToEbitda != null && v.evToEbitda > 25) flags.push('High EV/EBITDA');
  return flags;
}
