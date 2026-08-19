export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit' | 'stop_loss' | 'stop_limit';
export type TimeInForce = 'day' | 'gtc';
export type OrderStatus = 'draft' | 'pending' | 'submitted' | 'partially_filled' | 'filled' | 'cancelled' | 'rejected';

export interface OrderRequest {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: TimeInForce;
}

export interface Order extends OrderRequest {
  id: string;
  status: OrderStatus;
  filledQuantity: number;
  averageFillPrice?: number;
  createdAt: string;
  updatedAt: string;
  rejectionReason?: string;
}

export interface PositionInput {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
}

export interface PositionPnl {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  investedValue: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
}

export function validateOrder(request: OrderRequest): string[] {
  const errors: string[] = [];
  if (!request.symbol.trim()) errors.push('Symbol is required');
  if (!Number.isFinite(request.quantity) || request.quantity <= 0) errors.push('Quantity must be greater than zero');
  if (request.type === 'limit' || request.type === 'stop_limit') {
    if (!Number.isFinite(request.price) || (request.price ?? 0) <= 0) errors.push('A positive limit price is required');
  }
  if (request.type === 'stop_loss' || request.type === 'stop_limit') {
    if (!Number.isFinite(request.stopPrice) || (request.stopPrice ?? 0) <= 0) errors.push('A positive stop price is required');
  }
  if (request.side !== 'buy' && request.side !== 'sell') errors.push('Invalid order side');
  return errors;
}

export function createDraftOrder(request: OrderRequest, id: string, now = new Date().toISOString()): Order {
  const errors = validateOrder(request);
  if (errors.length) throw new Error(errors.join('; '));
  return { ...request, id, status: 'draft', filledQuantity: 0, createdAt: now, updatedAt: now };
}

export function transitionOrder(order: Order, next: OrderStatus, reason?: string): Order {
  const allowed: Record<OrderStatus, OrderStatus[]> = {
    draft: ['pending', 'rejected', 'cancelled'],
    pending: ['submitted', 'rejected', 'cancelled'],
    submitted: ['partially_filled', 'filled', 'rejected', 'cancelled'],
    partially_filled: ['partially_filled', 'filled', 'cancelled'],
    filled: [], cancelled: [], rejected: [],
  };
  if (!allowed[order.status].includes(next)) throw new Error(`Invalid order transition: ${order.status} -> ${next}`);
  return { ...order, status: next, updatedAt: new Date().toISOString(), ...(reason ? { rejectionReason: reason } : {}) };
}

export function applyFill(order: Order, fillQuantity: number, fillPrice: number): Order {
  if (!Number.isFinite(fillQuantity) || fillQuantity <= 0) throw new Error('Fill quantity must be greater than zero');
  if (!Number.isFinite(fillPrice) || fillPrice <= 0) throw new Error('Fill price must be greater than zero');
  if (order.filledQuantity + fillQuantity > order.quantity) throw new Error('Fill quantity exceeds order quantity');
  const newFilled = order.filledQuantity + fillQuantity;
  const previousValue = (order.averageFillPrice ?? 0) * order.filledQuantity;
  const averageFillPrice = (previousValue + fillPrice * fillQuantity) / newFilled;
  return {
    ...order,
    filledQuantity: newFilled,
    averageFillPrice,
    status: newFilled === order.quantity ? 'filled' : 'partially_filled',
    updatedAt: new Date().toISOString(),
  };
}

export function calculatePositionPnl(position: PositionInput): PositionPnl {
  if (position.quantity < 0 || position.averagePrice < 0 || position.currentPrice < 0) throw new Error('Position values must be non-negative');
  const investedValue = position.quantity * position.averagePrice;
  const marketValue = position.quantity * position.currentPrice;
  const unrealizedPnl = marketValue - investedValue;
  return {
    ...position,
    investedValue,
    marketValue,
    unrealizedPnl,
    unrealizedPnlPct: investedValue === 0 ? 0 : (unrealizedPnl / investedValue) * 100,
  };
}
