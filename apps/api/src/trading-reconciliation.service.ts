import { Injectable } from '@nestjs/common';
import { TradingRepository } from './trading.repository';
import { createBrokerAdapter } from './trading.provider';
import type { BrokerAdapter } from './trading.types';
import type { TradingReconciliation } from './trading-reconciliation.types';

@Injectable()
export class TradingReconciliationService {
  private readonly broker: BrokerAdapter;

  constructor(private readonly repository: TradingRepository) {
    this.broker = createBrokerAdapter();
  }

  async reconcile(): Promise<TradingReconciliation> {
    const checkedAt = new Date().toISOString();
    const broker = await this.broker.health();

    if (!broker.configured || !broker.connected) {
      return {
        status: 'unavailable', checkedAt, broker, account: null, positions: [], brokerOrders: [],
        executionRequests: 0, completedExecutions: 0, unmatchedExecutions: [], warnings: [broker.message],
        message: 'Reconciliation is unavailable until a supported execution broker is connected.',
      };
    }

    const [account, positions, brokerOrders, executionRequests] = await Promise.all([
      this.broker.getAccount(), this.broker.getPositions(), this.broker.listOrders(), this.repository.listExecutionRequests(),
    ]);
    const brokerOrderIds = new Set(brokerOrders.map((order) => order.id));
    const completed = executionRequests.filter((item) => item.status === 'completed' && item.orderId);
    const unmatchedExecutions = completed.filter((item) => item.orderId && !brokerOrderIds.has(item.orderId)).map((item) => item.orderId as string);
    const warnings: string[] = [];
    if (unmatchedExecutions.length) warnings.push(`${unmatchedExecutions.length} completed local execution record(s) were not returned by the broker order snapshot.`);

    const status = unmatchedExecutions.length ? 'drift' : 'healthy';
    void this.repository.audit('portfolio.reconciliation_completed', {
      status, executionRequests: executionRequests.length, completedExecutions: completed.length,
      unmatchedExecutions, positionCount: positions.length,
    });

    return {
      status, checkedAt, broker, account, positions, brokerOrders,
      executionRequests: executionRequests.length, completedExecutions: completed.length,
      unmatchedExecutions, warnings,
      message: status === 'healthy'
        ? 'Broker order snapshot is consistent with the locally recorded completed executions.'
        : 'Reconciliation detected a broker/local execution mismatch. Review the audit trail before taking corrective action.',
    };
  }
}
