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
  timestamp: string;
  currency: string;
  source: string;
}

export interface TradingAccount {
  availableCash?: number;
  totalEquity?: number;
  currency: string;
}

export interface BrokerAdapter {
  readonly name: string;
  health(): Promise<BrokerHealth>;
  capabilities(): Promise<BrokerCapabilities | null>;
  quote(symbol: string): Promise<BrokerQuote | null>;
  placeOrder(request: OrderRequest): Promise<Order>;
  cancelOrder(orderId: string): Promise<Order>;
  getOrder(orderId: string): Promise<Order | null>;
  listOrders(): Promise<Order[]>;
  getPositions(): Promise<PositionPnl[]>;
  getAccount(): Promise<TradingAccount>;
}
