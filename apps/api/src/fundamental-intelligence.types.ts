import { FundamentalSnapshot } from './fundamentals.types';

export type IntelligenceBand = 'strong' | 'healthy' | 'mixed' | 'weak' | 'insufficient-data';

export interface FundamentalIntelligence {
  symbol: string;
  available: boolean;
  score: number | null;
  band: IntelligenceBand;
  coveragePct: number;
  valuation: { pe?: number; forwardPe?: number; priceToBook?: number; evToEbitda?: number };
  profitability: { roe?: number; roa?: number; netMarginPct?: number; operatingMarginPct?: number };
  balanceSheet: { totalDebt?: number; totalCash?: number; netDebt?: number };
  cashFlow: { operatingCashFlow?: number; freeCashFlow?: number };
  trends: { revenueGrowthPct?: number; netIncomeGrowthPct?: number; epsGrowthPct?: number };
  source: { provider: string; retrievedAt: string } | null;
  message?: string;
}

export function intelligenceFromSnapshot(snapshot: FundamentalSnapshot, source: { provider: string; retrievedAt: string }): FundamentalIntelligence {
  const metrics: Array<number | undefined> = [snapshot.pe, snapshot.priceToBook, snapshot.roe, snapshot.roa, snapshot.netMarginPct, snapshot.operatingMarginPct, snapshot.revenue, snapshot.netIncome, snapshot.eps, snapshot.freeCashFlow];
  const valid = metrics.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (valid.length === 0) return { symbol: snapshot.symbol, available: false, score: null, band: 'insufficient-data', coveragePct: 0, valuation: {}, profitability: {}, balanceSheet: {}, cashFlow: {}, trends: {}, source, message: 'Insufficient verified fundamentals to calculate intelligence.' };
  const signals: number[] = [];
  if (Number.isFinite(snapshot.roe)) signals.push(Math.max(0, Math.min(100, (snapshot.roe! + 10) * 2.5)));
  if (Number.isFinite(snapshot.netMarginPct)) signals.push(Math.max(0, Math.min(100, snapshot.netMarginPct! * 3 + 50)));
  if (Number.isFinite(snapshot.operatingMarginPct)) signals.push(Math.max(0, Math.min(100, snapshot.operatingMarginPct! * 2 + 50)));
  if (Number.isFinite(snapshot.freeCashFlow)) signals.push(snapshot.freeCashFlow! > 0 ? 75 : 25);
  if (Number.isFinite(snapshot.totalDebt) && Number.isFinite(snapshot.totalCash)) signals.push(snapshot.totalDebt! <= snapshot.totalCash! ? 80 : 40);
  const score = signals.length ? Math.round(signals.reduce((a,b)=>a+b,0)/signals.length) : null;
  const band: IntelligenceBand = score === null ? 'insufficient-data' : score >= 80 ? 'strong' : score >= 65 ? 'healthy' : score >= 45 ? 'mixed' : 'weak';
  const pct = Math.round((valid.length / metrics.length) * 100);
  const periods = snapshot.periods ?? [];
  const growth = (key: 'revenue'|'netIncome'|'eps') => { if (periods.length < 2) return undefined; const newer = periods[0]?.[key]; const older = periods[1]?.[key]; return typeof newer === 'number' && typeof older === 'number' && Number.isFinite(newer) && Number.isFinite(older) && older !== 0 ? ((newer - older) / Math.abs(older)) * 100 : undefined; };
  return { symbol: snapshot.symbol, available: true, score, band, coveragePct: pct, valuation: { pe: snapshot.pe, forwardPe: snapshot.forwardPe, priceToBook: snapshot.priceToBook, evToEbitda: snapshot.evToEbitda }, profitability: { roe: snapshot.roe, roa: snapshot.roa, netMarginPct: snapshot.netMarginPct, operatingMarginPct: snapshot.operatingMarginPct }, balanceSheet: { totalDebt: snapshot.totalDebt, totalCash: snapshot.totalCash, netDebt: typeof snapshot.totalDebt === 'number' && typeof snapshot.totalCash === 'number' ? snapshot.totalDebt - snapshot.totalCash : undefined }, cashFlow: { operatingCashFlow: snapshot.operatingCashFlow, freeCashFlow: snapshot.freeCashFlow }, trends: { revenueGrowthPct: growth('revenue'), netIncomeGrowthPct: growth('netIncome'), epsGrowthPct: growth('eps') }, source };
}