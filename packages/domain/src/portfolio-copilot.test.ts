import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPortfolioCopilotContext } from './portfolio-copilot';

test('portfolio copilot context is grounded in deterministic evidence', () => {
  const context = buildPortfolioCopilotContext({
    question: 'Why is my portfolio risky?',
    asOf: '2026-08-20T00:00:00.000Z',
    intelligence: {
      equity: 1_000_000,
      investedValue: 950_000,
      cashValue: 50_000,
      cashPct: 5,
      concentrationPct: 45,
      largestPosition: { symbol: 'RELIANCE', weightPct: 45 },
      sectorExposure: [{ sector: 'Energy', marketValue: 500_000, weightPct: 50 }],
      betaWeighted: 1.4,
      riskLevel: 'critical',
      warnings: ['Single-position concentration is above 40% of equity.'],
      actions: ['Review the largest position and consider diversification before increasing exposure.'],
    },
    riskTwin: {
      equity: 1_000_000,
      investedValue: 950_000,
      cashPct: 5,
      concentrationPct: 45,
      largestPosition: { symbol: 'RELIANCE', weightPct: 45 },
      scenarios: [{
        scenario: 'drawdown_20',
        portfolioValueAfter: 800_000,
        lossAmount: 200_000,
        lossPct: 20,
        breachedDailyLimit: true,
        breachedDrawdownLimit: true,
        warnings: [],
      }],
      warnings: [],
    },
    knowledge: [],
  });

  assert.equal(context.answerability, 'grounded');
  assert.equal(context.evidence.find((item) => item.id === 'largest-position')?.value, 'RELIANCE (45.00%)');
  assert.ok(context.evidence.some((item) => item.id === 'worst-stress'));
  assert.ok(context.systemInstructions.some((instruction) => instruction.includes('Never invent')));
  assert.ok(context.limitations.some((limitation) => limitation.includes('not forecasts')));
});
