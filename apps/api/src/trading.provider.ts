import { Injectable } from '@nestjs/common';
import type { Order, OrderRequest, PositionPnl } from '@investiq/domain';
import type { BrokerAdapter, BrokerHealth, TradingAccount } from './trading.types';

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
