export interface PricePoint {
  timestamp: string;
  close: number;
}

export interface StockStats {
  startValue: number;
  endValue: number;
  absoluteReturnPct: number;
  cagrPct: number;
  annualizedVolatilityPct: number;
  maxDrawdownPct: number;
  bestPeriodPct: number;
  worstPeriodPct: number;
}

export interface AnnualReturn {
  year: number;
  returnPct: number;
  partial: boolean;
}

export interface TechnicalIndicators {
  sma20?: number;
  sma50?: number;
  sma200?: number;
  rsi14?: number;
  priceVsSma20Pct?: number;
  priceVsSma50Pct?: number;
  priceVsSma200Pct?: number;
}

export interface EventOutcome {
  horizonDays: number;
  observations: number;
  positivePct: number;
  medianReturnPct: number;
  bestReturnPct: number;
  worstReturnPct: number;
}

export interface RelativePerformance {
  stockReturnPct: number;
  benchmarkReturnPct: number;
  excessReturnPct: number;
  stockCagrPct: number;
  benchmarkCagrPct: number;
}

export interface ScenarioProjection {
  name: 'bear' | 'base' | 'bull';
  annualReturnPct: number;
  projectedValue: number;
  assumption: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_DAYS = 365.25;

function ordered(points: PricePoint[]): PricePoint[] {
  return points
    .filter((point) => Number.isFinite(point.close) && point.close > 0 && Number.isFinite(Date.parse(point.timestamp)))
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function cagr(start: number, end: number, years: number): number {
  if (start <= 0 || end <= 0 || years <= 0) return 0;
  return (Math.pow(end / start, 1 / years) - 1) * 100;
}

export function calculateStockStats(points: PricePoint[]): StockStats {
  const data = ordered(points);
  if (data.length < 2) throw new Error('At least two price observations are required');
  const first = data[0]!;
  const last = data[data.length - 1]!;
  const years = Math.max(1 / YEAR_DAYS, (Date.parse(last.timestamp) - Date.parse(first.timestamp)) / (YEAR_DAYS * DAY_MS));
  const returns: number[] = [];
  let peak = first.close;
  let maxDrawdown = 0;
  for (let i = 1; i < data.length; i += 1) {
    const previous = data[i - 1]!.close;
    const current = data[i]!.close;
    returns.push(current / previous - 1);
    peak = Math.max(peak, current);
    maxDrawdown = Math.min(maxDrawdown, (current / peak - 1) * 100);
  }
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / Math.max(1, returns.length - 1);
  return {
    startValue: first.close,
    endValue: last.close,
    absoluteReturnPct: (last.close / first.close - 1) * 100,
    cagrPct: cagr(first.close, last.close, years),
    annualizedVolatilityPct: Math.sqrt(variance) * Math.sqrt(252) * 100,
    maxDrawdownPct: maxDrawdown,
    bestPeriodPct: Math.max(...returns) * 100,
    worstPeriodPct: Math.min(...returns) * 100,
  };
}

export function calculateAnnualReturns(points: PricePoint[]): AnnualReturn[] {
  const data = ordered(points);
  const byYear = new Map<number, PricePoint[]>();
  for (const point of data) {
    const year = new Date(point.timestamp).getUTCFullYear();
    const rows = byYear.get(year) ?? [];
    rows.push(point);
    byYear.set(year, rows);
  }
  return [...byYear.entries()].sort(([a], [b]) => a - b).map(([year, rows]) => {
    const first = rows[0]!;
    const last = rows[rows.length - 1]!;
    return {
      year,
      returnPct: (last.close / first.close - 1) * 100,
      partial: new Date(first.timestamp).getUTCMonth() !== 0 || new Date(last.timestamp).getUTCMonth() !== 11,
    };
  });
}

function sma(values: number[]): number | undefined {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
}

export function calculateTechnicalIndicators(points: PricePoint[]): TechnicalIndicators {
  const data = ordered(points);
  const closes = data.map((point) => point.close);
  const latest = closes.at(-1);
  const result: TechnicalIndicators = {};
  if (latest === undefined) return result;
  const windows = [20, 50, 200] as const;
  for (const window of windows) {
    if (closes.length >= window) {
      const average = sma(closes.slice(-window));
      if (average !== undefined) {
        result[`sma${window}` as 'sma20' | 'sma50' | 'sma200'] = average;
        result[`priceVsSma${window}Pct` as 'priceVsSma20Pct' | 'priceVsSma50Pct' | 'priceVsSma200Pct'] = (latest / average - 1) * 100;
      }
    }
  }
  if (closes.length >= 15) {
    let gains = 0;
    let losses = 0;
    for (let i = closes.length - 14; i < closes.length; i += 1) {
      const change = closes[i]! - closes[i - 1]!;
      if (change >= 0) gains += change; else losses -= change;
    }
    const averageGain = gains / 14;
    const averageLoss = losses / 14;
    result.rsi14 = averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);
  }
  return result;
}

/**
 * Finds historical daily declines at or below the trigger, then measures subsequent
 * calendar-day outcomes. Qualifying declines inside the same selloff episode are
 * treated as one observation so a prolonged crash cannot dominate the sample.
 */
export function historicalEventOutcomes(points: PricePoint[], triggerPct: number, horizons: number[] = [5, 20, 60, 252]): EventOutcome[] {
  const data = ordered(points);
  if (triggerPct >= 0) throw new Error('Trigger must be negative, for example -8 for an 8% fall');
  const eventIndices: number[] = [];
  const cooldownObservations = 20;
  for (let i = 1; i < data.length; i += 1) {
    const eventReturn = (data[i]!.close / data[i - 1]!.close - 1) * 100;
    if (eventReturn <= triggerPct && (eventIndices.length === 0 || i - eventIndices[eventIndices.length - 1]! > cooldownObservations)) eventIndices.push(i);
  }
  return horizons.filter((horizon) => horizon > 0).map((horizonDays) => {
    const outcomes: number[] = [];
    for (const eventIndex of eventIndices) {
      const target = Date.parse(data[eventIndex]!.timestamp) + horizonDays * DAY_MS;
      let low = eventIndex + 1;
      let high = data.length - 1;
      let match = -1;
      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        if (Date.parse(data[middle]!.timestamp) >= target) { match = middle; high = middle - 1; } else low = middle + 1;
      }
      if (match >= 0) outcomes.push((data[match]!.close / data[eventIndex]!.close - 1) * 100);
    }
    return { horizonDays, observations: outcomes.length, positivePct: outcomes.length ? outcomes.filter((value) => value > 0).length / outcomes.length * 100 : 0, medianReturnPct: median(outcomes), bestReturnPct: outcomes.length ? Math.max(...outcomes) : 0, worstReturnPct: outcomes.length ? Math.min(...outcomes) : 0 };
  });
}

export function compareAgainstBenchmark(stock: PricePoint[], benchmark: PricePoint[]): RelativePerformance {
  const stockData = ordered(stock); const benchmarkData = ordered(benchmark);
  if (stockData.length < 2 || benchmarkData.length < 2) throw new Error('Both series need at least two observations');
  const stockFirst = stockData[0]!; const stockLast = stockData[stockData.length - 1]!;
  const benchmarkFirst = benchmarkData[0]!; const benchmarkLast = benchmarkData[benchmarkData.length - 1]!;
  const stockYears = Math.max(1 / YEAR_DAYS, (Date.parse(stockLast.timestamp) - Date.parse(stockFirst.timestamp)) / (YEAR_DAYS * DAY_MS));
  const benchmarkYears = Math.max(1 / YEAR_DAYS, (Date.parse(benchmarkLast.timestamp) - Date.parse(benchmarkFirst.timestamp)) / (YEAR_DAYS * DAY_MS));
  const stockReturn = (stockLast.close / stockFirst.close - 1) * 100;
  const benchmarkReturn = (benchmarkLast.close / benchmarkFirst.close - 1) * 100;
  return { stockReturnPct: stockReturn, benchmarkReturnPct: benchmarkReturn, excessReturnPct: stockReturn - benchmarkReturn, stockCagrPct: cagr(stockFirst.close, stockLast.close, stockYears), benchmarkCagrPct: cagr(benchmarkFirst.close, benchmarkLast.close, benchmarkYears) };
}

/** Scenario math is deliberately assumption-driven; it does not predict the market. */
export function projectScenarios(currentValue: number, years: number, assumptions: { bear: number; base: number; bull: number }): ScenarioProjection[] {
  if (currentValue < 0 || years < 0) throw new Error('Value and years must be non-negative');
  return (Object.entries(assumptions) as Array<['bear' | 'base' | 'bull', number]>).map(([name, annualReturnPct]) => ({ name, annualReturnPct, projectedValue: currentValue * Math.pow(1 + annualReturnPct / 100, years), assumption: `${annualReturnPct.toFixed(2)}% annual return assumption` }));
}
