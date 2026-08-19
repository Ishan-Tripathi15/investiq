import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFill, calculatePositionPnl, createDraftOrder, transitionOrder, validateOrder } from './trading';

test('trading domain: validates required prices', () => {
  assert.ok(validateOrder({ symbol: 'RELIANCE', side: 'buy', type: 'limit', quantity: 10 }).includes('A positive limit price is required'));
});

test('trading domain: moves a valid order through submission and fill', () => {
  const draft = createDraftOrder({ symbol: 'RELIANCE', side: 'buy', type: 'market', quantity: 10 }, 'ord_1', '2026-08-19T00:00:00.000Z');
  const pending = transitionOrder(draft, 'pending');
  const submitted = transitionOrder(pending, 'submitted');
  const filled = applyFill(submitted, 10, 2500);
  assert.equal(filled.status, 'filled');
  assert.equal(filled.averageFillPrice, 2500);
});

test('trading domain: calculates unrealized pnl', () => {
  const result = calculatePositionPnl({ symbol: 'RELIANCE', quantity: 10, averagePrice: 2000, currentPrice: 2200 });
  assert.equal(result.investedValue, 20000);
  assert.equal(result.marketValue, 22000);
  assert.equal(result.unrealizedPnl, 2000);
  assert.equal(result.unrealizedPnlPct, 10);
});
