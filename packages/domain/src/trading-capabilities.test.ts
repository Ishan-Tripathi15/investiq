import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOrderCapabilities, type BrokerCapabilities } from './trading-capabilities';

const capabilities: BrokerCapabilities = {
  broker: 'test', exchange: 'NSE', currency: 'INR',
  supportedOrderTypes: ['market', 'limit', 'stop_loss', 'stop_limit'],
  supportedTimeInForce: ['day', 'gtc'], fractionalQuantity: false,
  minQuantity: 1, maxQuantity: 1000, quantityStep: 1, priceTick: 0.05,
  regularSessionOnly: true,
};

test('trading capabilities: accepts a valid NSE-style order', () => {
  assert.equal(validateOrderCapabilities({ symbol: 'RELIANCE', side: 'buy', type: 'limit', quantity: 10, price: 2000, timeInForce: 'day' }, capabilities).supported, true);
});

test('trading capabilities: rejects unsupported order types', () => {
  assert.equal(validateOrderCapabilities({ symbol: 'RELIANCE', side: 'buy', type: 'market', quantity: 10 }, { ...capabilities, supportedOrderTypes: ['limit'] }).supported, false);
});

test('trading capabilities: rejects quantities that violate the step', () => {
  assert.equal(validateOrderCapabilities({ symbol: 'RELIANCE', side: 'buy', type: 'limit', quantity: 1.5, price: 2000 }, capabilities).supported, false);
});

test('trading capabilities: rejects prices outside the tick grid', () => {
  assert.equal(validateOrderCapabilities({ symbol: 'RELIANCE', side: 'buy', type: 'limit', quantity: 10, price: 2000.03 }, capabilities).supported, false);
});
