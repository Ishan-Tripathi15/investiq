export interface HistoricalValuationInput {
  date: string;
  marketCap?: number;
  earnings?: number;
  bookValue?: number;
  revenue?: number;
  ebitda?: number;
}

export interface HistoricalValuationPoint {
  date: string;
  pe?: number;
  pb?: number;
  ps?: number;
  evToEbitda?: number;
}

export interface ValuationRegime {
  metric: 'pe' | 'pb' | 'ps' | 'evToEbitda';
  current?: number;
  median?: number;
  percentile?: number;
  observations: number;
  status: 'cheap' | 'normal' | 'expensive' | 'unavailable';
}

function positive(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0;
}
function median(values: number[]): number | undefined {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1]! + sorted[middle]!) / 2;
}
function status(percentile: number | undefined): ValuationRegime['status'] {
  if (percentile === undefined) return 'unavailable';
  if (percentile <= 25) return 'cheap';
  if (percentile >= 75) return 'expensive';
  return 'normal';
}

/** Builds ratios only from supplied verified observations; missing inputs stay missing. */
export function buildHistoricalValuation(points: HistoricalValuationInput[]): HistoricalValuationPoint[] {
  return [...points]
    .filter((point) => Number.isFinite(Date.parse(point.date)))
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
    .map((point) => ({
      date: point.date,
      ...(positive(point.marketCap) && positive(point.earnings) ? { pe: point.marketCap / point.earnings } : {}),
      ...(positive(point.marketCap) && positive(point.bookValue) ? { pb: point.marketCap / point.bookValue } : {}),
      ...(positive(point.marketCap) && positive(point.revenue) ? { ps: point.marketCap / point.revenue } : {}),
      ...(positive(point.marketCap) && positive(point.ebitda) ? { evToEbitda: point.marketCap / point.ebitda } : {}),
    }));
}

export function summarizeValuation(points: HistoricalValuationPoint[], metric: ValuationRegime['metric']): ValuationRegime {
  const values = points.map((point) => point[metric]).filter((value): value is number => positive(value));
  const current = values.at(-1);
  const medianValue = median(values);
  const percentile = current === undefined ? undefined : values.filter((value) => value <= current).length / values.length * 100;
  return {
    metric,
    ...(current !== undefined ? { current } : {}),
    ...(medianValue !== undefined ? { median: medianValue } : {}),
    ...(percentile !== undefined ? { percentile } : {}),
    observations: values.length,
    status: status(percentile),
  };
}

export function valuationRegimes(points: HistoricalValuationPoint[]): ValuationRegime[] {
  return ['pe', 'pb', 'ps', 'evToEbitda'].map((metric) => summarizeValuation(points, metric as ValuationRegime['metric']));
}
