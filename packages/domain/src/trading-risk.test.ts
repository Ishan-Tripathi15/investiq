import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePreTradeRisk } from './trading-risk';

const context = {
  account: { availableCash: 100_000, currency: 'INR' },
  positions: [],
  recentOrders: [],
  maxOrderQuantity: 1_000,
  maxOrderNotional: 50_000,
  maxOpenOrdersPerSymbol: 2,
  requirePriceForBuyingPowerCheck: true,
};

test('approves an order within limits and available cash', () => {
  const result = evaluatePreTradeRisk({ symbol: 'RELIANCE', side: 'buy', type: 'limit', quantity: 10, price: 2_000 }, context);
  assert.equal(result.decision, 'approved');
  assert.equal(result.estimatedNotional, 20_000);
});

test('rejects orders above the notional limit', () => {
  const result = evaluatePreTradeRisk({ symbol: 'RELIANCE', side: 'buy', type: 'limit', quantity: 30, price: 2_000 }, context);
  assert.equal(result.decision, 'rejected');
  assert.equal(result.checks.find((check) => check.code === 'notional_limit')?.passed, false);
});

test('rejects duplicate open orders', () => {
  const result = evaluatePreTradeRisk({ symbol: 'RELIANCE', side: 'buy', type: 'limit', quantity: 10, price: 2_000 }, {
    ...context,
    recentOrders: [{ id: '1', symbol: 'RELIANCE', side: 'buy', type: 'limit', quantity: 10, price: 2_000, status: 'submitted', filledQuantity: 0 }],
  });
  assert.equal(result.decision, 'rejected');
  assert.equal(result.checks.find((check) => check.code === 'duplicate_order')?.passed, false);
});

test('requires trusted pricing for market buy buying-power checks', () => {
  const result = evaluatePreTradeRisk({ symbol: 'RELIANCE', side: 'buy', type: 'market', quantity: 10 }, context);
  assert.equal(result.decision, 'rejected');
  assert.equal(result.checks.find((check) => check.code === 'buying_power')?.passed, false);
});
