import { describe, expect, it } from 'node:test';
import { evaluateBrokerCapabilities, type BrokerCapabilities } from './broker-capabilities';

const capabilities: BrokerCapabilities = {
  broker: 'test-broker', exchanges: ['NSE'], currencies: ['INR'],
  orderTypes: ['market', 'limit', 'stop_loss', 'stop_limit'], timeInForce: ['day', 'gtc'],
  quantity: { min: 1, max: 1000, step: 1, fractional: false },
  price: { min: 0.05, max: 1_000_000, tickSize: 0.05 },
};

describe('broker capabilities', () => {
  it('approves a valid order', () => {
    expect(evaluateBrokerCapabilities({ type: 'limit', timeInForce: 'day', quantity: 10, price: 125.5 }, capabilities).allowed).toBe(true);
  });
  it('rejects fractional quantity', () => {
    expect(evaluateBrokerCapabilities({ type: 'market', quantity: 1.5 }, capabilities).allowed).toBe(false);
  });
  it('rejects invalid tick size', () => {
    expect(evaluateBrokerCapabilities({ type: 'limit', quantity: 10, price: 125.03 }, capabilities).allowed).toBe(false);
  });
});
