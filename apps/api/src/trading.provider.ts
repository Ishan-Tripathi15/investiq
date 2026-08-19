import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { BrokerCapabilities, Order, OrderRequest, PositionPnl } from '@investiq/domain';
import { calculatePositionPnl as buildPositionPnl } from '@investiq/domain';
import type { BrokerAdapter, BrokerHealth, BrokerQuote, TradingAccount } from './trading.types';
import { resolveBrokerConfiguration } from './broker-config';
import { BrokerConnectionRepository } from './broker-connection.repository';
import { decryptBrokerToken } from './broker-crypto';

const UNCONFIGURED_CAPABILITIES: BrokerCapabilities = {
  broker: 'unconfigured', exchange: 'NSE', currency: 'INR', supportedOrderTypes: [], supportedTimeInForce: [],
  fractionalQuantity: false, minQuantity: 1, maxQuantity: 0, quantityStep: 1, priceTick: 0.05, regularSessionOnly: true,
};

const KITE_API_ROOT = 'https://api.kite.trade';

interface KiteEnvelope<T> { status?: string; message?: string; data?: T; }
interface KiteOrder {
  order_id?: string; status?: string; tradingsymbol?: string; exchange?: string; transaction_type?: string;
  order_type?: string; quantity?: number; price?: number; trigger_price?: number; validity?: string;
  average_price?: number; filled_quantity?: number; order_timestamp?: string; exchange_update_timestamp?: string;
  status_message?: string;
}
interface KiteHolding { tradingsymbol?: string; exchange?: string; quantity?: number; average_price?: number; last_price?: number; }
interface KiteMargins { available?: { live_balance?: number; cash?: number }; net?: number; }

function requiredApiKey(): string {
  const value = process.env.KITE_API_KEY?.trim();
  if (!value) throw new ServiceUnavailableException('KITE_API_KEY is not configured');
  return value;
}

function domainOrderType(value: string | undefined): Order['type'] {
  if (value === 'LIMIT') return 'limit';
  if (value === 'SL') return 'stop_limit';
  if (value === 'SL-M') return 'stop_loss';
  return 'market';
}

function domainStatus(value: string | undefined): Order['status'] {
  const normalized = (value ?? '').toUpperCase();
  if (normalized === 'COMPLETE') return 'filled';
  if (normalized === 'CANCELLED') return 'cancelled';
  if (normalized === 'REJECTED') return 'rejected';
  if (normalized.includes('PENDING') || normalized.includes('RECEIVED') || normalized === 'OPEN') return 'pending';
  return 'submitted';
}

function mapKiteOrder(row: KiteOrder): Order {
  const now = new Date().toISOString();
  const createdAt = row.order_timestamp ? new Date(row.order_timestamp.replace(' ', 'T') + 'Z').toISOString() : now;
  const updatedAt = row.exchange_update_timestamp ? new Date(row.exchange_update_timestamp.replace(' ', 'T') + 'Z').toISOString() : createdAt;
  const type = domainOrderType(row.order_type);
  const result: Order = {
    id: String(row.order_id ?? ''),
    symbol: String(row.tradingsymbol ?? ''),
    side: row.transaction_type === 'SELL' ? 'sell' : 'buy',
    type,
    quantity: Number(row.quantity ?? 0),
    status: domainStatus(row.status),
    filledQuantity: Number(row.filled_quantity ?? 0),
    createdAt,
    updatedAt,
  };
  if (row.price && row.price > 0) result.price = row.price;
  if ((type === 'stop_loss' || type === 'stop_limit') && row.trigger_price && row.trigger_price > 0) result.stopPrice = row.trigger_price;
  if (row.average_price && row.average_price > 0) result.averageFillPrice = row.average_price;
  if (row.status_message) result.rejectionReason = row.status_message;
  return result;
}

@Injectable()
export class UnconfiguredBrokerAdapter implements BrokerAdapter {
  readonly name: string;
  constructor(name = 'unconfigured') { this.name = name; }
  async health(): Promise<BrokerHealth> {
    return { configured: false, connected: false, broker: this.name,
      message: this.name === 'unconfigured'
        ? 'No execution broker is configured. InvestIQ will not simulate or fabricate order execution.'
        : `Broker provider "${this.name}" is configured by name, but no production adapter is installed yet. InvestIQ will not simulate or fabricate execution.` };
  }
  async capabilities(): Promise<BrokerCapabilities | null> { return { ...UNCONFIGURED_CAPABILITIES, broker: this.name }; }
  async quote(_symbol: string): Promise<BrokerQuote | null> { return null; }
  async placeOrder(_userId: string, _request: OrderRequest): Promise<Order> { throw new Error('Trading execution is unavailable until a supported broker adapter is configured'); }
  async cancelOrder(_userId: string, _orderId: string): Promise<Order> { throw new Error('Trading execution is unavailable until a supported broker adapter is configured'); }
  async getOrder(_userId: string, _orderId: string): Promise<Order | null> { return null; }
  async listOrders(_userId: string): Promise<Order[]> { return []; }
  async getPositions(_userId: string): Promise<PositionPnl[]> { return []; }
  async getAccount(_userId: string): Promise<TradingAccount> { return { currency: 'INR' }; }
}

export class KiteBrokerAdapter implements BrokerAdapter {
  readonly name = 'zerodha';

  constructor(private readonly connections: BrokerConnectionRepository) {}

  private async connection(userId: string) {
    const record = await this.connections.getConnection(userId, this.name);
    if (!record) throw new ServiceUnavailableException('Zerodha account is not connected for this InvestIQ user');
    return record;
  }

  private async request<T>(userId: string, path: string, init: RequestInit = {}): Promise<T> {
    const connection = await this.connection(userId);
    const apiKey = requiredApiKey();
    const token = decryptBrokerToken(connection.encryptedAccessToken);
    const headers = new Headers(init.headers);
    headers.set('X-Kite-Version', '3');
    headers.set('Authorization', `token ${apiKey}:${token}`);
    const response = await fetch(`${KITE_API_ROOT}${path}`, { ...init, headers });
    const payload = await response.json() as KiteEnvelope<T>;
    if (!response.ok || payload.status !== 'success') {
      throw new ServiceUnavailableException(payload.message ?? `Zerodha API request failed with HTTP ${response.status}`);
    }
    return payload.data as T;
  }

  async health(userId?: string): Promise<BrokerHealth> {
    const provider = resolveBrokerConfiguration().provider;
    if (provider !== 'zerodha') return { configured: false, connected: false, broker: provider || 'unconfigured', message: 'Set BROKER_PROVIDER=zerodha to enable the Zerodha execution adapter.' };
    if (!process.env.KITE_API_KEY?.trim()) return { configured: false, connected: false, broker: this.name, message: 'KITE_API_KEY is not configured.' };
    if (!userId) return { configured: true, connected: false, broker: this.name, message: 'Zerodha execution adapter is configured; a user broker connection is required.' };
    try {
      await this.request(userId, '/user/profile');
      return { configured: true, connected: true, broker: this.name, message: 'Zerodha account connection is active.' };
    } catch (error) {
      return { configured: true, connected: false, broker: this.name, message: error instanceof Error ? error.message : 'Zerodha account connection is unavailable.' };
    }
  }

  async capabilities(): Promise<BrokerCapabilities | null> {
    return {
      broker: this.name,
      exchange: 'NSE',
      currency: 'INR',
      supportedOrderTypes: ['market', 'limit', 'stop_loss', 'stop_limit'],
      supportedTimeInForce: ['day'],
      fractionalQuantity: false,
      minQuantity: 1,
      maxQuantity: Number(process.env.TRADING_MAX_ORDER_QUANTITY ?? 10000),
      quantityStep: 1,
      priceTick: 0,
      regularSessionOnly: true,
    };
  }

  async quote(_symbol: string): Promise<BrokerQuote | null> {
    return null;
  }

  async placeOrder(userId: string, request: OrderRequest): Promise<Order> {
    request = { ...request, symbol: request.symbol.trim().toUpperCase() };
    const orderType = request.type === 'stop_loss' ? 'SL-M' : request.type === 'stop_limit' ? 'SL' : request.type === 'limit' ? 'LIMIT' : 'MARKET';
    const body = new URLSearchParams({
      tradingsymbol: request.symbol,
      exchange: 'NSE',
      transaction_type: request.side === 'buy' ? 'BUY' : 'SELL',
      order_type: orderType,
      quantity: String(request.quantity),
      product: 'CNC',
      validity: 'DAY',
      market_protection: '-1',
    });
    if (request.price !== undefined) body.set('price', String(request.price));
    if (request.stopPrice !== undefined) body.set('trigger_price', String(request.stopPrice));
    const data = await this.request<{ order_id?: string }>(userId, '/orders/regular', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!data.order_id) throw new ServiceUnavailableException('Zerodha did not return an order id');
    const now = new Date().toISOString();
    return { ...request, id: data.order_id, status: 'submitted', filledQuantity: 0, createdAt: now, updatedAt: now };
  }

  async cancelOrder(userId: string, orderId: string): Promise<Order> {
    const data = await this.request<{ order_id?: string }>(userId, `/orders/regular/${encodeURIComponent(orderId)}`, { method: 'DELETE' });
    const existing = await this.getOrder(userId, data.order_id ?? orderId);
    if (!existing) throw new ServiceUnavailableException('Zerodha cancelled the order but no order snapshot was returned');
    return existing;
  }

  async getOrder(userId: string, orderId: string): Promise<Order | null> {
    const history = await this.request<KiteOrder[]>(userId, `/orders/${encodeURIComponent(orderId)}`);
    const latest = history?.[history.length - 1];
    return latest ? mapKiteOrder(latest) : null;
  }

  async listOrders(userId: string): Promise<Order[]> {
    const rows = await this.request<KiteOrder[]>(userId, '/orders');
    return (rows ?? []).map(mapKiteOrder);
  }

  async getPositions(userId: string): Promise<PositionPnl[]> {
    const holdings = await this.request<KiteHolding[]>(userId, '/portfolio/holdings');
    return (holdings ?? []).filter((row) => Number(row.quantity ?? 0) > 0 && Number(row.average_price ?? 0) >= 0 && Number(row.last_price ?? 0) >= 0).map((row) => buildPositionPnl({
      symbol: String(row.tradingsymbol ?? ''),
      quantity: Number(row.quantity ?? 0),
      averagePrice: Number(row.average_price ?? 0),
      currentPrice: Number(row.last_price ?? 0),
    }));
  }

  async getAccount(userId: string): Promise<TradingAccount> {
    const data = await this.request<KiteMargins>(userId, '/user/margins/equity');
    return { currency: 'INR', availableCash: data?.available?.live_balance ?? data?.available?.cash, totalEquity: data?.net };
  }
}

export function createBrokerAdapter(connections?: BrokerConnectionRepository): BrokerAdapter {
  const configuration = resolveBrokerConfiguration();
  if (configuration.provider === 'zerodha' && connections) return new KiteBrokerAdapter(connections);
  return new UnconfiguredBrokerAdapter(configuration.provider);
}
