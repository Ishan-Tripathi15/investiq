import { Injectable } from '@nestjs/common';
import type { BrokerCapabilities, Order, OrderRequest, PositionPnl } from '@investiq/domain';
import type { BrokerAdapter, BrokerHealth, BrokerQuote, TradingAccount } from './trading.types';
import { resolveBrokerConfiguration } from './broker-config';

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
  readonly name: string;

  constructor(name = 'unconfigured') {
    this.name = name;
  }

  async health(): Promise<BrokerHealth> {
    return {
      configured: false,
      connected: false,
      broker: this.name,
      message: this.name === 'unconfigured'
        ? 'No execution broker is configured. InvestIQ will not simulate or fabricate order execution.'
        : `Broker provider "${this.name}" is configured by name, but no production adapter is installed yet. InvestIQ will not simulate or fabricate execution.`,
    };
  }

  async capabilities(): Promise<BrokerCapabilities | null> {
    return { ...UNCONFIGURED_CAPABILITIES, broker: this.name };
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
  const config = resolveBrokerConfiguration();
  return new UnconfiguredBrokerAdapter(config.provider);
}
