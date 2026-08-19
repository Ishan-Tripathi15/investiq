import { describe, expect, it } from 'vitest';
import { applyFill, calculatePositionPnl, createDraftOrder, transitionOrder, validateOrder } from './trading';

describe('trading domain', () => {
  it('validates required prices', () => {
    expect(validateOrder({ symbol: 'RELIANCE', side: 'buy', type: 'limit', quantity: 10 })).toContain('A positive limit price is required');
  });

  it('moves a valid order through submission and fill', () => {
    const draft = createDraftOrder({ symbol: 'RELIANCE', side: 'buy', type: 'market', quantity: 10 }, 'ord_1', '2026-08-19T00:00:00.000Z');
    const pending = transitionOrder(draft, 'pending');
    const submitted = transitionOrder(pending, 'submitted');
    const filled = applyFill(submitted, 10, 2500);
    expect(filled.status).toBe('filled');
    expect(filled.averageFillPrice).toBe(2500);
  });

  it('calculates unrealized pnl', () => {
    const result = calculatePositionPnl({ symbol: 'RELIANCE', quantity: 10, averagePrice: 2000, currentPrice: 2200 });
    expect(result.investedValue).toBe(20000);
    expect(result.marketValue).toBe(22000);
    expect(result.unrealizedPnl).toBe(2000);
    expect(result.unrealizedPnlPct).toBe(10);
  });
});
