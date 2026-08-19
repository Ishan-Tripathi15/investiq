import type { BrokerCapabilities, Order, OrderRequest, PositionPnl } from '@investiq/domain';

export interface BrokerHealth {
  configured: boolean;
  connected: boolean;
  broker: string;
  message: string;
}

export interface BrokerQuote {
  symbol: string;
  price: number;
  currency: string;
  timestamp: string;
  source: string;
}

export interface TradingAccount {
  availableCash?: number;
  totalEquity?: number;
  currency: string;
}

export interface BrokerAdapter {
  readonly name: string;
  health(userId?: string): Promise<BrokerHealth>;
  capabilities(): Promise<BrokerCapabilities | null>;
  quote(symbol: string): Promise<BrokerQuote | null>;
  placeOrder(userId: string, request: OrderRequest): Promise<Order>;
  cancelOrder(userId: string, orderId: string): Promise<Order>;
  getOrder(userId: string, orderId: string): Promise<Order | null>;
  listOrders(userId: string): Promise<Order[]>;
  getPositions(userId: string): Promise<PositionPnl[]>;
  getAccount(userId: string): Promise<TradingAccount>;
}
