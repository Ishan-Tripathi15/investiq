import type { AiAnalysisContext } from './ai-intelligence';

export type AiRiskLevel = 'low' | 'medium' | 'high' | 'unknown';

export interface AiAnalysisResult {
  summary: string;
  confidence: number;
  riskLevel: AiRiskLevel;
  keySignals: string[];
  riskFactors: string[];
  assumptions: string[];
  invalidationConditions: string[];
  citedFeatures: string[];
}

const FEATURE_KEYS = new Set([
  'periodReturnPct', 'cagrPct', 'volatilityPct', 'maxDrawdownPct',
  'revenueCagrPct', 'earningsCagrPct', 'freeCashFlowCagrPct',
  'pe', 'pb', 'ps', 'evToEbitda', 'sentimentScore',
]);

function nonEmptyStrings(values: unknown): values is string[] {
  return Array.isArray(values) && values.every((value) => typeof value === 'string' && value.trim().length > 0);
}

export function validateAiAnalysis(result: unknown, context: AiAnalysisContext): AiAnalysisResult {
  if (!result || typeof result !== 'object') throw new Error('AI response must be an object');
  const value = result as Record<string, unknown>;
  const confidence = value.confidence;
  if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error('AI confidence must be between 0 and 1');
  }
  if (typeof value.summary !== 'string' || !value.summary.trim()) throw new Error('AI summary is required');
  if (!['low', 'medium', 'high', 'unknown'].includes(String(value.riskLevel))) throw new Error('AI risk level is invalid');
  if (!nonEmptyStrings(value.keySignals) || !nonEmptyStrings(value.riskFactors) || !nonEmptyStrings(value.assumptions) || !nonEmptyStrings(value.invalidationConditions) || !nonEmptyStrings(value.citedFeatures)) {
    throw new Error('AI response contains an invalid list field');
  }

  const citedFeatures = value.citedFeatures.map((item) => item.trim());
  for (const key of citedFeatures) {
    if (!FEATURE_KEYS.has(key)) throw new Error(`AI cited unsupported feature: ${key}`);
    if ((context.features as Record<string, unknown>)[key] === undefined) throw new Error(`AI cited unavailable feature: ${key}`);
  }

  return {
    summary: value.summary.trim(),
    confidence,
    riskLevel: value.riskLevel as AiRiskLevel,
    keySignals: value.keySignals,
    riskFactors: value.riskFactors,
    assumptions: value.assumptions,
    invalidationConditions: value.invalidationConditions,
    citedFeatures,
  };
}
