import type { PricePoint } from './stock-intelligence';

export interface AnnualReturn {
  year: number;
  startValue: number;
  endValue: number;
  returnPct: number;
}

export interface TechnicalIndicators {
  latestClose: number;
  sma20?: number;
  sma50?: number;
  sma200?: number;
  rsi14?: number;
  priceVsSma20Pct?: number;
  priceVsSma50Pct?: number;
  priceVsSma200Pct?: number;
}

function ordered(points: PricePoint[]): PricePoint[] {
  return points
    .filter((point) => Number.isFinite(point.close) && point.close > 0 && Number.isFinite(Date.parse(point.timestamp)))
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

/** Calendar-year performance using the first and last available trading session of each year. */
export function calculateAnnualReturns(points: PricePoint[]): AnnualReturn[] {
  const data = ordered(points);
  const byYear = new Map<number, PricePoint[]>();
  for (const point of data) {
    const year = new Date(point.timestamp).getUTCFullYear();
    const bucket = byYear.get(year) ?? [];
    bucket.push(point);
    byYear.set(year, bucket);
  }
  return [...byYear.entries()].sort(([a], [b]) => a - b).map(([year, values]) => {
    const first = values[0]!;
    const last = values[values.length - 1]!;
    return { year, startValue: first.close, endValue: last.close, returnPct: (last.close / first.close - 1) * 100 };
  });
}

function sma(data: PricePoint[], period: number): number | undefined {
  if (data.length < period) return undefined;
  const values = data.slice(-period).map((point) => point.close);
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Standard daily-price indicators. Values are calculated only from observations at or before the latest point. */
export function calculateTechnicalIndicators(points: PricePoint[]): TechnicalIndicators {
  const data = ordered(points);
  if (!data.length) throw new Error('At least one price observation is required');
  const latestClose = data[data.length - 1]!.close;
  const sma20 = sma(data, 20);
  const sma50 = sma(data, 50);
  const sma200 = sma(data, 200);

  let rsi14: number | undefined;
  if (data.length >= 15) {
    const changes = data.slice(1).map((point, index) => point.close - data[index]!.close).slice(-14);
    let gains = 0;
    let losses = 0;
    for (const change of changes) {
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }
    const averageGain = gains / 14;
    const averageLoss = losses / 14;
    rsi14 = averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);
  }

  const relativeTo = (value: number | undefined) => value === undefined ? undefined : (latestClose / value - 1) * 100;
  const result: TechnicalIndicators = { latestClose };
  if (sma20 !== undefined) result.sma20 = sma20;
  if (sma50 !== undefined) result.sma50 = sma50;
  if (sma200 !== undefined) result.sma200 = sma200;
  if (rsi14 !== undefined) result.rsi14 = rsi14;
  const priceVsSma20Pct = relativeTo(sma20);
  const priceVsSma50Pct = relativeTo(sma50);
  const priceVsSma200Pct = relativeTo(sma200);
  if (priceVsSma20Pct !== undefined) result.priceVsSma20Pct = priceVsSma20Pct;
  if (priceVsSma50Pct !== undefined) result.priceVsSma50Pct = priceVsSma50Pct;
  if (priceVsSma200Pct !== undefined) result.priceVsSma200Pct = priceVsSma200Pct;
  return result;
}
