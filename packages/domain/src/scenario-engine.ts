import { calculateFinancialQuality, type FinancialPeriodInput } from './financial-intelligence';
import type { StockStats } from './stock-intelligence';

export interface ScenarioEngineInput {
  currentValue: number;
  years: number;
  stock?: StockStats;
  financialPeriods?: FinancialPeriodInput[];
  pe?: number;
  forwardPe?: number;
  priceToBook?: number;
}

export interface ScenarioEngineOutput {
  scenarios: Array<{ name: 'bear' | 'base' | 'bull'; annualReturnPct: number; projectedValue: number; confidence: 'low' | 'medium'; assumptions: string[] }>;
  qualityScore?: number;
  warnings: string[];
}

function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }

/**
 * Transparent scenario engine. It combines historical evidence with financial quality
 * and valuation adjustments; it is not a predictive model and never claims certainty.
 */
export function buildScenarioEngine(input: ScenarioEngineInput): ScenarioEngineOutput {
  if (input.currentValue < 0 || input.years < 0) throw new Error('Value and years must be non-negative');
  const warnings: string[] = [];
  const periods = input.financialPeriods ?? [];
  const quality = periods.length ? calculateFinancialQuality(periods) : undefined;
  const historical = input.stock?.cagrPct;
  let base = historical ?? 10;
  if (historical == null) warnings.push('No verified price-history CAGR was supplied; base return uses a neutral 10% assumption.');
  if (quality) base += (quality.score - 50) * 0.08;
  if (input.pe != null && input.pe > 35) base -= 2;
  if (input.pe != null && input.pe > 0 && input.pe < 12) base += 1;
  if (input.priceToBook != null && input.priceToBook > 6) base -= 1;
  base = clamp(base, -30, 30);
  const volatility = input.stock?.annualizedVolatilityPct ?? 25;
  const spread = clamp(Math.max(6, volatility * 0.18), 6, 18);
  const bear = clamp(base - spread, -60, 40);
  const bull = clamp(base + spread, -20, 60);
  const scenarios = [
    { name: 'bear' as const, annualReturnPct: bear, projectedValue: input.currentValue * Math.pow(1 + bear / 100, input.years), confidence: 'low' as const, assumptions: ['Higher downside volatility than the base case.', quality ? `Financial quality score ${quality.score}/100 is included as a modifier.` : 'No financial quality data supplied.'] },
    { name: 'base' as const, annualReturnPct: base, projectedValue: input.currentValue * Math.pow(1 + base / 100, input.years), confidence: historical != null ? 'medium' as const : 'low' as const, assumptions: [historical != null ? `Anchored to historical CAGR of ${historical.toFixed(2)}%.` : 'Uses a neutral assumption because price history is unavailable.', quality ? `Financial quality contributes a transparent ${((quality.score - 50) * 0.08).toFixed(2)} percentage-point adjustment.` : 'No financial quality adjustment.', input.pe != null ? `Current P/E supplied: ${input.pe.toFixed(2)}.` : 'No current P/E supplied.'] },
    { name: 'bull' as const, annualReturnPct: bull, projectedValue: input.currentValue * Math.pow(1 + bull / 100, input.years), confidence: 'low' as const, assumptions: ['Favorable return regime relative to the base case.', 'This is an assumption range, not an AI prediction.'] },
  ];
  if (!input.stock) warnings.push('Price history is unavailable; scenarios should not be interpreted as historical-performance forecasts.');
  warnings.push('Scenario outputs are mathematical projections under stated assumptions, not guarantees or investment advice.');
  return { scenarios, qualityScore: quality?.score, warnings };
}
