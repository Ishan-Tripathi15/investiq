import type { Order, OrderRequest, PositionPnl } from '@investiq/domain';

export interface BrokerHealth {
  configured: boolean;
  connected: boolean;
  broker: string;
  message: string;
}

export interface TradingAccount {
  availableCash?: number;
  totalEquity?: number;
  currency: string;
}

export interface BrokerAdapter {
  readonly name: string;
  health(): Promise<BrokerHealth>;
  placeOrder(userId: string, request: OrderRequest): Promise<Order>;
  cancelOrder(userId: string, orderId: string): Promise<Order>;
  getOrder(userId: string, orderId: string): Promise<Order | null>;
  listOrders(userId: string): Promise<Order[]>;
  getPositions(userId: string): Promise<PositionPnl[]>;
  getAccount(userId: string): Promise<TradingAccount>;
}
