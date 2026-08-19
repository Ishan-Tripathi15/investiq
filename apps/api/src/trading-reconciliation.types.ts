import type { Order, PositionPnl } from '@investiq/domain';
import type { BrokerHealth, TradingAccount } from './trading.types';

export type ReconciliationStatus = 'healthy' | 'drift' | 'unavailable';

export interface TradingReconciliation {
  status: ReconciliationStatus;
  checkedAt: string;
  broker: BrokerHealth;
  account: TradingAccount | null;
  positions: PositionPnl[];
  brokerOrders: Order[];
  executionRequests: number;
  completedExecutions: number;
  unmatchedExecutions: string[];
  warnings: string[];
  message: string;
}
