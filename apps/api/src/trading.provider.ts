import { Injectable } from '@nestjs/common';
import type { BrokerCapabilities, Order, OrderRequest, PositionPnl } from '@investiq/domain';
import type { BrokerAdapter, BrokerHealth, BrokerQuote, TradingAccount } from './trading.types';

const UNCONFIGURED_CAPABILITIES: BrokerCapabilities = {
  broker: 'unconfigured',
  exchange: 'NSE',
  currency: 'INR',
  supportedOrderTypes: [],
  supportedTimeInForce: [],
  fractionalQuantity: false,
  minQuantity: 1,
  maxQuantity: 0,
  quantityStep: 1,
  priceTick: 0.05,
  regularSessionOnly: true,
};

@Injectable()
export class UnconfiguredBrokerAdapter implements BrokerAdapter {
  readonly name = 'unconfigured';

  async health(): Promise<BrokerHealth> {
    return {
      configured: false,
      connected: false,
      broker: this.name,
      message: 'No execution broker is configured. InvestIQ will not simulate or fabricate order execution.',
    };
  }

  async capabilities(): Promise<BrokerCapabilities | null> {
    return UNCONFIGURED_CAPABILITIES;
  }

  async quote(_symbol: string): Promise<BrokerQuote | null> {
    return null;
  }

  async placeOrder(_request: OrderRequest): Promise<Order> {
    throw new Error('Trading execution is unavailable until a supported broker adapter is configured');
  }

  async cancelOrder(_orderId: string): Promise<Order> {
    throw new Error('Trading execution is unavailable until a supported broker adapter is configured');
  }

  async getOrder(_orderId: string): Promise<Order | null> {
    return null;
  }

  async listOrders(): Promise<Order[]> {
    return [];
  }

  async getPositions(): Promise<PositionPnl[]> {
    return [];
  }

  async getAccount(): Promise<TradingAccount> {
    return { currency: 'INR' };
  }
}

export function createBrokerAdapter(): BrokerAdapter {
  return new UnconfiguredBrokerAdapter();
}
