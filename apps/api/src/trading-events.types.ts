export type TradingEventType =
  | 'order.previewed'
  | 'order.execution_requested'
  | 'order.execution_succeeded'
  | 'order.execution_failed'
  | 'order.execution_unavailable'
  | 'order.cancelled'
  | 'portfolio.reconciliation_completed';

export interface TradingEvent {
  id: number | string;
  type: TradingEventType;
  orderId?: string;
  idempotencyKey?: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface TradingEventCursor {
  afterId?: number;
  limit: number;
}
