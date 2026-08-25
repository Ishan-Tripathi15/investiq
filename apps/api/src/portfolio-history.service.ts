import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PortfolioHistoryRepository } from './portfolio-history.repository';
import { TradingService } from './trading.service';

@Injectable()
export class PortfolioHistoryService {
  constructor(private readonly history: PortfolioHistoryRepository, private readonly trading: TradingService) {}

  async get(userId: string, days = 365) {
    const health = await this.trading.health(userId);
    if (!health.configured || !health.connected) {
      return { connected: false, history: [], message: health.message };
    }

    const provider = health.broker;
    try {
      const account = await this.trading.account(userId);
      if (account.totalEquity !== undefined && Number.isFinite(account.totalEquity) && account.totalEquity >= 0) {
        await this.history.record(userId, provider, account.totalEquity);
      }
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        return { connected: true, history: await this.history.list(userId, provider, days), message: error.message };
      }
      throw error;
    }

    return { connected: true, history: await this.history.list(userId, provider, days), source: 'verified-broker-account-equity' };
  }
}
