import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPortfolioCopilotContext, buildPortfolioIntelligence, buildRiskTwin } from './index';

test('portfolio copilot includes relevant historical memory as non-authoritative evidence', () => {
  const intelligence = buildPortfolioIntelligence(1_000_000, 100_000, [
    { symbol: 'RELIANCE', marketValue: 400_000 },
    { symbol: 'TCS', marketValue: 300_000 },
  ]);
  const riskTwin = buildRiskTwin({
    equity: 1_000_000,
    availableCash: 100_000,
    positions: [
      { symbol: 'RELIANCE', marketValue: 400_000 },
      { symbol: 'TCS', marketValue: 300_000 },
    ],
  });

  const context = buildPortfolioCopilotContext({
    question: 'How has my concentration changed since last time?',
    intelligence,
    riskTwin,
    memory: [{
      id: 42,
      question: 'How concentrated is my portfolio?',
      answer: 'Your largest position was [concentration].',
      createdAt: '2026-08-20T10:00:00.000Z',
      snapshot: { equity: 900_000, cashValue: 90_000, concentrationPct: 50, riskLevel: 'critical' },
    }],
    asOf: '2026-08-22T00:00:00.000Z',
  });

  assert.equal(context.memory.length, 1);
  assert.ok(context.evidence.some((item) => item.id === 'memory:42'));
  assert.match(context.limitations.join(' '), /current verified portfolio data takes precedence/i);
  assert.match(context.systemInstructions.join(' '), /historical memory/i);
});
