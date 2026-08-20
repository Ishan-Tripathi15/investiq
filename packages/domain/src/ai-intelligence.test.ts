import test from 'node:test';
import assert from 'node:assert/strict';
import { assessAiDataQuality, buildAiAnalysisContext } from './ai-intelligence';

test('ai intelligence: refuses to claim complete data with sparse or unverified inputs', () => {
  const result = assessAiDataQuality([{ kind: 'price', provider: 'test', retrievedAt: '2026-01-01T00:00:00.000Z', verified: false, observationCount: 0 }], { cagrPct: 10 });
  assert.equal(result.complete, false);
  assert.ok(result.warnings.length >= 2);
});

test('ai intelligence: normalizes symbol and bounds sentiment', () => {
  const result = buildAiAnalysisContext(
    ' reliance ',
    '2026-01-01T00:00:00.000Z',
    { periodReturnPct: 20, cagrPct: 12, volatilityPct: 18, maxDrawdownPct: -25, sentimentScore: 7 },
    [
      { kind: 'price', provider: 'verified-test', retrievedAt: '2026-01-01T00:00:00.000Z', verified: true, observationCount: 100 },
      { kind: 'risk', provider: 'verified-test', retrievedAt: '2026-01-01T00:00:00.000Z', verified: true, observationCount: 100 },
    ],
  );
  assert.equal(result.symbol, 'RELIANCE');
  assert.equal(result.features.sentimentScore, 1);
  assert.ok(result.instructions.some((item) => item.includes('never invent')));
});
