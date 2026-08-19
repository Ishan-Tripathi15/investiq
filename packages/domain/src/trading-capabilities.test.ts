import { describe, expect, it } from 'vitest';
import { validateOrderCapabilities, type BrokerCapabilities } from './trading-capabilities';

const capabilities: BrokerCapabilities = {
  broker: 'test', exchange: 'NSE', currency: 'INR',
  supportedOrderTypes: ['market', 'limit', 'stop_loss', 'stop_limit'],
  supportedTimeInForce: ['day', 'gtc'], fractionalQuantity: false,
  minQuantity: 1, maxQuantity: 1000, quantityStep: 1, priceTick: 0.05,
  regularSessionOnly: true,
};

describe('validateOrderCapabilities', () => {
  it('accepts a valid NSE-style order', () => {
    expect(validateOrderCapabilities({ symbol: 'RELIANCE', side: 'buy', type: 'limit', quantity: 10, price: 2000, timeInForce: 'day' }, capabilities).supported).toBe(true);
  });
  it('rejects unsupported order types', () => {
    expect(validateOrderCapabilities({ symbol: 'RELIANCE', side: 'buy', type: 'market', quantity: 10 }, { ...capabilities, supportedOrderTypes: ['limit'] }).supported).toBe(false);
  });
  it('rejects quantities that violate the step', () => {
    expect(validateOrderCapabilities({ symbol: 'RELIANCE', side: 'buy', type: 'limit', quantity: 1.5, price: 2000 }, capabilities).supported).toBe(false);
  });
  it('rejects prices outside the tick grid', () => {
    expect(validateOrderCapabilities({ symbol: 'RELIANCE', side: 'buy', type: 'limit', quantity: 10, price: 2000.03 }, capabilities).supported).toBe(false);
  });
});
