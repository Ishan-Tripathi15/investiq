import { describe, expect, it } from 'vitest';
import { evaluatePreTradeRisk } from './trading-risk';

describe('evaluatePreTradeRisk', () => {
  const context = {
    account: { availableCash: 100_000, currency: 'INR' },
    positions: [],
    recentOrders: [],
    maxOrderQuantity: 1_000,
    maxOrderNotional: 50_000,
    maxOpenOrdersPerSymbol: 2,
    requirePriceForBuyingPowerCheck: true,
  };

  it('approves an order within limits and available cash', () => {
    const result = evaluatePreTradeRisk({ symbol: 'RELIANCE', side: 'buy', type: 'limit', quantity: 10, price: 2_000 }, context);
    expect(result.decision).toBe('approved');
    expect(result.estimatedNotional).toBe(20_000);
  });

  it('rejects orders above the notional limit', () => {
    const result = evaluatePreTradeRisk({ symbol: 'RELIANCE', side: 'buy', type: 'limit', quantity: 30, price: 2_000 }, context);
    expect(result.decision).toBe('rejected');
    expect(result.checks.find((check) => check.code === 'notional_limit')?.passed).toBe(false);
  });

  it('rejects duplicate open orders', () => {
    const result = evaluatePreTradeRisk({ symbol: 'RELIANCE', side: 'buy', type: 'limit', quantity: 10, price: 2_000 }, {
      ...context,
      recentOrders: [{ id: '1', symbol: 'RELIANCE', side: 'buy', type: 'limit', quantity: 10, price: 2_000, status: 'submitted', filledQuantity: 0 }],
    });
    expect(result.decision).toBe('rejected');
    expect(result.checks.find((check) => check.code === 'duplicate_order')?.passed).toBe(false);
  });

  it('requires trusted pricing for market buy buying-power checks', () => {
    const result = evaluatePreTradeRisk({ symbol: 'RELIANCE', side: 'buy', type: 'market', quantity: 10 }, context);
    expect(result.decision).toBe('rejected');
    expect(result.checks.find((check) => check.code === 'buying_power')?.passed).toBe(false);
  });
});
