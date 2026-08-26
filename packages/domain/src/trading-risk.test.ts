import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePreTradeRisk } from './trading-risk';

const context = {
  account: { availableCash: 100_000, totalEquity: 100_000, currency: 'INR' },
  positions: [],
  recentOrders: [],
  maxOrderQuantity: 1_000,
  maxOrderNotional: 50_000,
  maxOpenOrdersPerSymbol: 2,
  maxPositionConcentrationPct: 25,
  maxPortfolioExposurePct: 100,
  maxPriceDeviationPct: 10,
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

test('rejects a sell that exceeds the current position', () => {
  const result = evaluatePreTradeRisk({ symbol: 'RELIANCE', side: 'sell', type: 'market', quantity: 11 }, {
    ...context,
    positions: [{ symbol: 'RELIANCE', quantity: 10, averagePrice: 2_000, currentPrice: 2_100, investedValue: 20_000, marketValue: 21_000, unrealizedPnl: 1_000, unrealizedPnlPct: 5 }],
  });
  assert.equal(result.decision, 'rejected');
  assert.equal(result.checks.find((check) => check.code === 'position_quantity')?.passed, false);
});

test('rejects a buy that breaches position concentration', () => {
  const result = evaluatePreTradeRisk({ symbol: 'RELIANCE', side: 'buy', type: 'limit', quantity: 10, price: 2_000 }, {
    ...context,
    positions: [{ symbol: 'RELIANCE', quantity: 5, averagePrice: 2_000, currentPrice: 2_000, investedValue: 10_000, marketValue: 10_000, unrealizedPnl: 0, unrealizedPnlPct: 0 }],
  });
  assert.equal(result.decision, 'rejected');
  assert.equal(result.checks.find((check) => check.code === 'position_concentration')?.passed, false);
});

test('rejects a buy that breaches portfolio exposure', () => {
  const result = evaluatePreTradeRisk({ symbol: 'RELIANCE', side: 'buy', type: 'limit', quantity: 10, price: 2_000 }, {
    ...context,
    maxPositionConcentrationPct: 100,
    positions: [{ symbol: 'TCS', quantity: 40, averagePrice: 2_000, currentPrice: 2_000, investedValue: 80_000, marketValue: 80_000, unrealizedPnl: 0, unrealizedPnlPct: 0 }],
  });
  assert.equal(result.decision, 'rejected');
  assert.equal(result.checks.find((check) => check.code === 'portfolio_exposure')?.passed, false);
});

test('rejects a priced order that exceeds the reference-price deviation', () => {
  const result = evaluatePreTradeRisk({ symbol: 'RELIANCE', side: 'buy', type: 'limit', quantity: 1, price: 2_300 }, {
    ...context,
    positions: [{ symbol: 'RELIANCE', quantity: 1, averagePrice: 2_000, currentPrice: 2_000, investedValue: 2_000, marketValue: 2_000, unrealizedPnl: 0, unrealizedPnlPct: 0 }],
  });
  assert.equal(result.decision, 'rejected');
  assert.equal(result.checks.find((check) => check.code === 'price_deviation')?.passed, false);
});
