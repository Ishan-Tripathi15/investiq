import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { evaluatePreTradeRisk, type OrderRequest } from '@investiq/domain';
import { createBrokerAdapter } from './trading.provider';
import { BrokerConnectionRepository } from './broker-connection.repository';
import type { BrokerAdapter } from './trading.types';

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

@Injectable()
export class TradingRiskService {
  private readonly broker: BrokerAdapter;

  constructor(private readonly connections: BrokerConnectionRepository) {
    this.broker = createBrokerAdapter(connections);
  }

  async evaluate(userId: string, request: OrderRequest) {
    const health = await this.broker.health(userId);
    if (!health.configured || !health.connected) {
      throw new ServiceUnavailableException(health.message);
    }

    const [account, positions, recentOrders] = await Promise.all([
      this.broker.getAccount(userId),
      this.broker.getPositions(userId),
      this.broker.listOrders(userId),
    ]);

    const result = evaluatePreTradeRisk(request, {
      account,
      positions,
      recentOrders,
      maxOrderQuantity: envNumber('TRADING_MAX_ORDER_QUANTITY', 10000),
      maxOrderNotional: envNumber('TRADING_MAX_ORDER_NOTIONAL', 1000000),
      maxOpenOrdersPerSymbol: envNumber('TRADING_MAX_OPEN_ORDERS_PER_SYMBOL', 5),
      requirePriceForBuyingPowerCheck: process.env.TRADING_REQUIRE_PRICE_FOR_BUYING_POWER !== 'false',
    });

    if (result.decision === 'rejected') {
      throw new BadRequestException({ message: 'Pre-trade risk check failed', risk: result });
    }

    return { ...result, broker: health.broker };
  }
}
