import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPortfolioExplanation, buildPortfolioIntelligence, buildRiskTwin } from './index';

test('portfolio explanation is grounded in deterministic intelligence and risk twin', () => {
  const intelligence = buildPortfolioIntelligence(1_000_000, 20_000, [
    { symbol: 'RELIANCE', marketValue: 500_000 },
    { symbol: 'TCS', marketValue: 300_000 },
    { symbol: 'HDFC', marketValue: 180_000 },
  ]);
  const riskTwin = buildRiskTwin({
    equity: 1_000_000,
    availableCash: 20_000,
    positions: [
      { symbol: 'RELIANCE', marketValue: 500_000 },
      { symbol: 'TCS', marketValue: 300_000 },
      { symbol: 'HDFC', marketValue: 180_000 },
    ],
  });

  const explanation = buildPortfolioExplanation(intelligence, riskTwin);
  assert.equal(explanation.riskLevel, 'critical');
  assert.match(explanation.headline, /critical/i);
  assert.ok(explanation.evidence.some((item) => item.code === 'largest_position'));
  assert.equal(explanation.evidence.find((item) => item.code === 'largest_position')?.value, 50);
  assert.equal(explanation.scenarioHighlights.length, 6);
  assert.match(explanation.disclaimer, /not forecasts/i);
});
