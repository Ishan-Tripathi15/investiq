import { calculateFundHistoricalStats, type FundHistoricalStats, type FundNavPoint } from './mutual-fund-risk';
import { calculateRollingReturns, type RollingReturn } from './mutual-fund-analytics';

export interface FundComparisonInput {
  key: string;
  points: FundNavPoint[];
}

export interface FundComparisonMetrics {
  key: string;
  risk: FundHistoricalStats | null;
  rolling: RollingReturn[];
}

export interface FundComparisonScore {
  fundKey: string;
  score: number;
  strengths: string[];
}

export function buildFundComparison(input: FundComparisonInput): FundComparisonMetrics {
  return {
    key: input.key,
    risk: calculateFundHistoricalStats(input.points),
    rolling: calculateRollingReturns(input.points, [1, 3, 5]),
  };
}

/**
 * Produces a descriptive historical score only. It deliberately does not rank
 * funds by expected future performance or imply an investment recommendation.
 */
export function scoreHistoricalFunds(funds: FundComparisonMetrics[]): FundComparisonScore[] {
  if (!funds.length) return [];
  const valid = funds.filter((fund) => fund.risk !== null);
  if (!valid.length) return [];

  const metrics = (selector: (risk: FundHistoricalStats) => number) => valid.map((fund) => selector(fund.risk!));
  const normalize = (value: number, values: number[], higherIsBetter: boolean) => {
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max === min) return 50;
    const ratio = (value - min) / (max - min);
    return (higherIsBetter ? ratio : 1 - ratio) * 100;
  };

  const cagrValues = metrics((risk) => risk.cagrPct);
  const drawdownValues = metrics((risk) => risk.maxDrawdownPct);
  const volatilityValues = metrics((risk) => risk.annualizedVolatilityPct);
  const positiveRollingValues = valid.map((fund) => fund.rolling.find((r) => r.windowYears === 3)?.positivePct ?? 0);

  return valid.map((fund) => {
    const risk = fund.risk!;
    const score =
      normalize(risk.cagrPct, cagrValues, true) * 0.35 +
      normalize(risk.maxDrawdownPct, drawdownValues, true) * 0.25 +
      normalize(risk.annualizedVolatilityPct, volatilityValues, false) * 0.20 +
      normalize(fund.rolling.find((r) => r.windowYears === 3)?.positivePct ?? 0, positiveRollingValues, true) * 0.20;

    const strengths: string[] = [];
    if (risk.cagrPct === Math.max(...cagrValues)) strengths.push('Highest historical CAGR');
    if (risk.maxDrawdownPct === Math.max(...drawdownValues)) strengths.push('Shallowest historical drawdown');
    if (risk.annualizedVolatilityPct === Math.min(...volatilityValues)) strengths.push('Lowest historical volatility');
    if ((fund.rolling.find((r) => r.windowYears === 3)?.positivePct ?? 0) === Math.max(...positiveRollingValues)) strengths.push('Most consistent 3Y rolling outcomes');

    return { fundKey: fund.key, score, strengths };
  });
}
