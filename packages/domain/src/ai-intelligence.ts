export type AiDataKind = 'price' | 'fundamental' | 'valuation' | 'technical' | 'risk' | 'news' | 'portfolio';

export interface AiDataSource {
  kind: AiDataKind;
  provider: string;
  retrievedAt: string;
  verified: boolean;
  observationCount: number;
}

export interface AiNumericFeatures {
  periodReturnPct?: number;
  cagrPct?: number;
  volatilityPct?: number;
  maxDrawdownPct?: number;
  revenueCagrPct?: number;
  earningsCagrPct?: number;
  freeCashFlowCagrPct?: number;
  pe?: number;
  pb?: number;
  ps?: number;
  evToEbitda?: number;
  sentimentScore?: number;
}

export interface AiDataQuality {
  score: number;
  complete: boolean;
  warnings: string[];
}

export interface AiAnalysisContext {
  symbol: string;
  asOf: string;
  features: AiNumericFeatures;
  sources: AiDataSource[];
  quality: AiDataQuality;
  instructions: string[];
}

function finite(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) ? value : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function assessAiDataQuality(sources: AiDataSource[], features: AiNumericFeatures): AiDataQuality {
  const warnings: string[] = [];
  const verifiedSources = sources.filter((source) => source.verified && source.observationCount > 0).length;
  const featureCount = Object.values(features).filter((value) => value !== undefined && Number.isFinite(value)).length;
  const score = clamp(Math.round((verifiedSources * 25) + (Math.min(featureCount, 10) * 5)), 0, 100);

  if (!sources.length) warnings.push('No verified data sources are available.');
  if (verifiedSources !== sources.length) warnings.push('One or more data sources are unverified or empty.');
  if (featureCount < 4) warnings.push('The feature set is sparse; analysis should remain low-confidence.');

  return { score, complete: score >= 70 && warnings.length === 0, warnings };
}

export function buildAiAnalysisContext(
  symbol: string,
  asOf: string,
  features: AiNumericFeatures,
  sources: AiDataSource[],
): AiAnalysisContext {
  const normalizedFeatures: AiNumericFeatures = {
    periodReturnPct: finite(features.periodReturnPct),
    cagrPct: finite(features.cagrPct),
    volatilityPct: finite(features.volatilityPct),
    maxDrawdownPct: finite(features.maxDrawdownPct),
    revenueCagrPct: finite(features.revenueCagrPct),
    earningsCagrPct: finite(features.earningsCagrPct),
    freeCashFlowCagrPct: finite(features.freeCashFlowCagrPct),
    pe: finite(features.pe),
    pb: finite(features.pb),
    ps: finite(features.ps),
    evToEbitda: finite(features.evToEbitda),
    sentimentScore: features.sentimentScore === undefined ? undefined : clamp(features.sentimentScore, -1, 1),
  };

  const quality = assessAiDataQuality(sources, normalizedFeatures);
  return {
    symbol: symbol.trim().toUpperCase(),
    asOf,
    features: normalizedFeatures,
    sources: sources.map((source) => ({ ...source })),
    quality,
    instructions: [
      'Use only supplied verified observations; never invent market data.',
      'Distinguish historical observations from forward-looking scenarios.',
      'State missing data and uncertainty explicitly.',
      'Treat projections as scenarios, not guarantees or financial advice.',
    ],
  };
}
