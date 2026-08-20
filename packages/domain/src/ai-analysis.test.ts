import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAiAnalysisContext } from './ai-intelligence';
import { validateAiAnalysis } from './ai-analysis';

const context = buildAiAnalysisContext(
  'RELIANCE',
  '2026-08-20T00:00:00.000Z',
  { cagrPct: 12, volatilityPct: 18, maxDrawdownPct: -25 },
  [{ kind: 'price', provider: 'verified-test', retrievedAt: '2026-08-20T00:00:00.000Z', verified: true, observationCount: 100 }],
);

test('ai analysis: accepts only grounded cited features', () => {
  const result = validateAiAnalysis({
    summary: 'Historical performance is positive but volatile.', confidence: 0.72, riskLevel: 'medium',
    keySignals: ['Positive CAGR'], riskFactors: ['Drawdown'], assumptions: ['Historical regime remains comparable'],
    invalidationConditions: ['Volatility materially increases'], citedFeatures: ['cagrPct', 'volatilityPct', 'maxDrawdownPct'],
  }, context);
  assert.equal(result.confidence, 0.72);
});

test('ai analysis: rejects unsupported or unavailable cited features', () => {
  assert.throws(() => validateAiAnalysis({
    summary: 'Unsupported claim', confidence: 0.5, riskLevel: 'unknown', keySignals: ['x'], riskFactors: ['x'],
    assumptions: ['x'], invalidationConditions: ['x'], citedFeatures: ['pe'],
  }, context));
});

test('ai analysis: rejects invalid confidence', () => {
  assert.throws(() => validateAiAnalysis({
    summary: 'x', confidence: 2, riskLevel: 'low', keySignals: ['x'], riskFactors: ['x'],
    assumptions: ['x'], invalidationConditions: ['x'], citedFeatures: [],
  }, context));
});
