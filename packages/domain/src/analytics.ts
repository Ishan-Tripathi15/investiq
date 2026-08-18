export interface PricePoint {
  timestamp: string;
  close: number;
}

export interface DrawdownPoint {
  timestamp: string;
  drawdownPct: number;
  peak: number;
}

export interface ReturnStats {
  startValue: number;
  endValue: number;
  absoluteReturnPct: number;
  cagrPct: number;
  volatilityPct: number;
  maxDrawdownPct: number;
  bestPeriodPct: number;
  worstPeriodPct: number;
}

export interface EventOutcome {
  horizonDays: number;
  observations: number;
  positivePct: number;
  medianReturnPct: number;
}

function sorted(points: PricePoint[]): PricePoint[] {
  return [...points].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

export function calculateCagr(startValue: number, endValue: number, years: number): number {
  if (startValue <= 0 || endValue < 0 || years < 0) throw new Error('Invalid CAGR inputs');
  if (years === 0) return 0;
  return (Math.pow(endValue / startValue, 1 / years) - 1) * 100;
}

export function calculateDrawdowns(points: PricePoint[]): DrawdownPoint[] {
  let peak = 0;
  return sorted(points).map((point) => {
    peak = Math.max(peak, point.close);
    return {
      timestamp: point.timestamp,
      peak,
      drawdownPct: peak === 0 ? 0 : ((point.close - peak) / peak) * 100,
    };
  });
}

export function calculateStats(points: PricePoint[]): ReturnStats {
  const data = sorted(points);
  if (data.length < 2) throw new Error('At least two price points are required');

  const start = data[0].close;
  const end = data[data.length - 1].close;
  const years = (new Date(data[data.length - 1].timestamp).getTime() - new Date(data[0].timestamp).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  const periodReturns = data.slice(1).map((point, index) => ((point.close - data[index].close) / data[index].close) * 100);
  const average = periodReturns.reduce((sum, value) => sum + value, 0) / periodReturns.length;
  const variance = periodReturns.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / periodReturns.length;
  const maxDrawdown = Math.min(...calculateDrawdowns(data).map((point) => point.drawdownPct));

  return {
    startValue: start,
    endValue: end,
    absoluteReturnPct: ((end - start) / start) * 100,
    cagrPct: calculateCagr(start, end, years),
    volatilityPct: Math.sqrt(variance),
    maxDrawdownPct: maxDrawdown,
    bestPeriodPct: Math.max(...periodReturns),
    worstPeriodPct: Math.min(...periodReturns),
  };
}

export function historicalEventOutcomes(points: PricePoint[], triggerPct: number, horizons: number[]): EventOutcome[] {
  const data = sorted(points);
  return horizons.map((horizonDays) => {
    const outcomes: number[] = [];
    for (let index = 1; index < data.length; index += 1) {
      const move = ((data[index].close - data[index - 1].close) / data[index - 1].close) * 100;
      if (move > triggerPct) continue;
      const targetTime = new Date(data[index].timestamp).getTime() + horizonDays * 24 * 60 * 60 * 1000;
      const future = data.find((point) => new Date(point.timestamp).getTime() >= targetTime);
      if (future) outcomes.push(((future.close - data[index].close) / data[index].close) * 100);
    }
    return {
      horizonDays,
      observations: outcomes.length,
      positivePct: outcomes.length ? (outcomes.filter((value) => value > 0).length / outcomes.length) * 100 : 0,
      medianReturnPct: median(outcomes),
    };
  });
}
