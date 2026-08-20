import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAiAnalysisContext } from './ai-intelligence';
import { AI_EVALUATION_DATASET, evaluateAiAnalysis, evaluateAiDataset } from './ai-evaluation';

function context(features: Record<string, number | undefined>) {
  return buildAiAnalysisContext(
    'RELIANCE',
    '2026-08-20T00:00:00.000Z',
    features,
    [{ kind: 'price', provider: 'verified-test', retrievedAt: '2026-08-20T00:00:00.000Z', verified: true, observationCount: 100 }],
  );
}

test('ai evaluation: accepts a grounded historical analysis', () => {
  const testCase = AI_EVALUATION_DATASET[0];
  const result = evaluateAiAnalysis(testCase, context({ cagrPct: 12, volatilityPct: 18, maxDrawdownPct: -25 }), {
    summary: 'Historical performance is positive but uncertain because volatility and drawdown remain material.',
    confidence: 0.72,
    riskLevel: 'medium',
    keySignals: ['Positive CAGR', 'Elevated volatility'],
    riskFactors: ['Large historical drawdown creates uncertainty'],
    assumptions: ['Historical behaviour remains comparable; historical results are not guaranteed'],
    invalidationConditions: ['Volatility materially increases'],
    citedFeatures: ['cagrPct', 'volatilityPct', 'maxDrawdownPct'],
  });
  assert.equal(result.valid, true);
  assert.equal(result.score, 100);
});

test('ai evaluation: rejects overconfident sparse-data output', () => {
  const testCase = AI_EVALUATION_DATASET[1];
  const result = evaluateAiAnalysis(testCase, context({ periodReturnPct: 2 }), {
    summary: 'The stock will rise strongly.',
    confidence: 0.95,
    riskLevel: 'low',
    keySignals: ['Positive return'],
    riskFactors: ['Limited information'],
    assumptions: ['Unknown future conditions'],
    invalidationConditions: ['Price falls'],
    citedFeatures: ['periodReturnPct'],
  });
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('overconfidence'));
  assert.ok(result.failures.includes('missing_risk'));
});

test('ai evaluation: rejects unavailable feature citations', () => {
  const testCase = AI_EVALUATION_DATASET[0];
  const result = evaluateAiAnalysis(testCase, context({ cagrPct: 12 }), {
    summary: 'Historical CAGR is available but other data is limited and uncertain.',
    confidence: 0.4,
    riskLevel: 'medium',
    keySignals: ['CAGR'],
    riskFactors: ['Incomplete data'],
    assumptions: ['Historical only'],
    invalidationConditions: ['New data invalidates the setup'],
    citedFeatures: ['cagrPct', 'pe'],
  });
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('unsupported_citation'));
});

test('ai evaluation: returns deterministic dataset metrics', () => {
  const contexts = Object.fromEntries(AI_EVALUATION_DATASET.map((item) => [item.id, context({
    periodReturnPct: 2, cagrPct: 12, volatilityPct: 18, maxDrawdownPct: -25, pe: 20,
  })]));
  const responses = Object.fromEntries(AI_EVALUATION_DATASET.map((item) => [item.id, {
    summary: 'Historical analysis with uncertainty and explicit limits.', confidence: 0.4, riskLevel: item.requiredRiskLevel,
    keySignals: ['Historical signal'], riskFactors: ['Uncertainty remains'], assumptions: ['Historical results are not guaranteed'],
    invalidationConditions: ['Material regime change'], citedFeatures: item.expectedFeatures,
  }]));
  const report = evaluateAiDataset(contexts, responses);
  assert.equal(report.datasetVersion, '2026-08-20.v1');
  assert.equal(report.results.length, 3);
  assert.equal(report.passRatePct, 100);
  assert.equal(report.averageScore, 100);
});
