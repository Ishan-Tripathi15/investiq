import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPortfolioCopilotContext } from './portfolio-copilot';
import { validatePortfolioCopilotResponse } from './portfolio-copilot-response';

const context = buildPortfolioCopilotContext({
  question: 'How concentrated is my portfolio?',
  asOf: '2026-08-20T00:00:00.000Z',
  intelligence: {
    equity: 100000,
    investedValue: 90000,
    cashValue: 10000,
    cashPct: 10,
    concentrationPct: 45,
    largestPosition: { symbol: 'ABC', marketValue: 45000, weightPct: 45 },
    sectorExposure: [{ sector: 'Technology', marketValue: 50000, weightPct: 50 }],
    riskLevel: 'high',
    warnings: ['Largest position exceeds 40%'],
    actions: ['Reduce concentration'],
  },
  riskTwin: {
    equity: 100000,
    availableCash: 10000,
    scenarios: [
      { scenario: 'drawdown_20', lossPct: 20, lossValue: 20000, remainingEquity: 80000, breachedDailyLimit: true, breachedDrawdownLimit: true },
    ],
    warnings: [],
  },
  knowledge: [],
});

test('accepts grounded cited response', () => {
  const result = validatePortfolioCopilotResponse({
    answer: 'Your largest position is [largest-position], so concentration is the main portfolio risk.',
    confidence: 'medium',
    riskLevel: 'high',
    limitations: [],
    requiresHumanReview: false,
  }, context);
  assert.deepEqual(result.evidenceIds, ['largest-position']);
  assert.equal(result.requiresHumanReview, false);
});

test('rejects unsupported evidence citation', () => {
  assert.throws(() => validatePortfolioCopilotResponse({
    answer: 'The portfolio is strong [made-up-evidence].',
    confidence: 'low',
    riskLevel: 'unknown',
    limitations: [],
    requiresHumanReview: true,
  }, context), /unsupported evidence/);
});

test('rejects uncited numeric claims', () => {
  assert.throws(() => validatePortfolioCopilotResponse({
    answer: 'Your portfolio is down 12%. [risk-level]',
    confidence: 'medium',
    riskLevel: 'high',
    limitations: [],
    requiresHumanReview: true,
  }, context), /Numeric claims/);
});

test('rejects trade execution instructions', () => {
  assert.throws(() => validatePortfolioCopilotResponse({
    answer: 'Place a buy order now [risk-level].',
    confidence: 'medium',
    riskLevel: 'high',
    limitations: [],
    requiresHumanReview: true,
  }, context), /execution instruction/);
});
