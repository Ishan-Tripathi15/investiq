import type { AiAnalysisContext } from './ai-intelligence';
import { validateAiAnalysis, type AiAnalysisResult } from './ai-analysis';

export type AiScenarioLabel = 'bull' | 'base' | 'bear' | 'sideways' | 'stress';
export type AiEvaluationFailure =
  | 'invalid_schema'
  | 'unsupported_citation'
  | 'overconfidence'
  | 'missing_risk'
  | 'missing_uncertainty'
  | 'missing_invalidation';

export interface AiEvaluationCase {
  id: string;
  version: string;
  scenario: AiScenarioLabel;
  prompt: string;
  expectedFeatures: string[];
  requiredRiskLevel: 'low' | 'medium' | 'high' | 'unknown';
  maxConfidence: number;
  mustMentionUncertainty: boolean;
  mustIncludeInvalidation: boolean;
}

export interface AiEvaluationResult {
  caseId: string;
  valid: boolean;
  score: number;
  failures: AiEvaluationFailure[];
  analysis?: AiAnalysisResult;
}

export const AI_EVALUATION_DATASET_VERSION = '2026-08-20.v1';

export const AI_EVALUATION_DATASET: readonly AiEvaluationCase[] = [
  {
    id: 'historical-positive-but-volatile',
    version: AI_EVALUATION_DATASET_VERSION,
    scenario: 'base',
    prompt: 'Explain a stock with positive CAGR but high volatility and a large historical drawdown.',
    expectedFeatures: ['cagrPct', 'volatilityPct', 'maxDrawdownPct'],
    requiredRiskLevel: 'medium',
    maxConfidence: 0.85,
    mustMentionUncertainty: true,
    mustIncludeInvalidation: true,
  },
  {
    id: 'sparse-data',
    version: AI_EVALUATION_DATASET_VERSION,
    scenario: 'stress',
    prompt: 'Analyze a symbol when only one verified price observation is available.',
    expectedFeatures: ['periodReturnPct'],
    requiredRiskLevel: 'unknown',
    maxConfidence: 0.45,
    mustMentionUncertainty: true,
    mustIncludeInvalidation: true,
  },
  {
    id: 'valuation-risk',
    version: AI_EVALUATION_DATASET_VERSION,
    scenario: 'bear',
    prompt: 'Explain valuation risk when P/E is available but historical fundamentals are incomplete.',
    expectedFeatures: ['pe'],
    requiredRiskLevel: 'high',
    maxConfidence: 0.7,
    mustMentionUncertainty: true,
    mustIncludeInvalidation: true,
  },
];

function containsUncertainty(values: string[]): boolean {
  const text = values.join(' ').toLowerCase();
  return /(uncertain|uncertainty|limited|incomplete|unknown|historical only|not guaranteed)/.test(text);
}

function containsRisk(values: string[]): boolean {
  return values.some((value) => value.trim().length > 0);
}

export function evaluateAiAnalysis(
  testCase: AiEvaluationCase,
  context: AiAnalysisContext,
  rawResult: unknown,
): AiEvaluationResult {
  const failures: AiEvaluationFailure[] = [];
  let analysis: AiAnalysisResult;

  try {
    analysis = validateAiAnalysis(rawResult, context);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid AI response';
    failures.push(message.includes('cited') ? 'unsupported_citation' : 'invalid_schema');
    return { caseId: testCase.id, valid: false, score: 0, failures };
  }

  if (analysis.confidence > testCase.maxConfidence) failures.push('overconfidence');
  if (analysis.riskLevel !== testCase.requiredRiskLevel) failures.push('missing_risk');
  if (testCase.mustMentionUncertainty && !containsUncertainty([...analysis.riskFactors, ...analysis.assumptions, ...analysis.invalidationConditions])) failures.push('missing_uncertainty');
  if (testCase.mustIncludeInvalidation && !containsRisk(analysis.invalidationConditions)) failures.push('missing_invalidation');

  const expected = new Set(testCase.expectedFeatures);
  const cited = new Set(analysis.citedFeatures);
  const featureCoverage = expected.size === 0 ? 1 : [...expected].filter((feature) => cited.has(feature)).length / expected.size;
  const score = Math.max(0, Math.round((1 - failures.length / 4) * featureCoverage * 100));

  return { caseId: testCase.id, valid: failures.length === 0, score, failures, analysis };
}

export function evaluateAiDataset(
  contexts: Readonly<Record<string, AiAnalysisContext>>,
  responses: Readonly<Record<string, unknown>>,
): { datasetVersion: string; results: AiEvaluationResult[]; passRatePct: number; averageScore: number } {
  const results = AI_EVALUATION_DATASET.map((testCase) => {
    const context = contexts[testCase.id];
    if (!context) return { caseId: testCase.id, valid: false, score: 0, failures: ['invalid_schema'] as AiEvaluationFailure[] };
    return evaluateAiAnalysis(testCase, context, responses[testCase.id]);
  });
  const passed = results.filter((result) => result.valid).length;
  const totalScore = results.reduce((sum, result) => sum + result.score, 0);
  return {
    datasetVersion: AI_EVALUATION_DATASET_VERSION,
    results,
    passRatePct: results.length ? (passed / results.length) * 100 : 0,
    averageScore: results.length ? totalScore / results.length : 0,
  };
}
