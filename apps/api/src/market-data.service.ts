import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { MarketDataCache } from './market-data.cache';
import { createMarketDataProvider, MarketDataProvider } from './market-data.provider';
import { MarketDataRepository } from './market-data.repository';
import { HistoricalResponse } from './market-data.types';

@Injectable()
export class MarketDataService implements OnModuleInit, OnModuleDestroy {
  private readonly provider: MarketDataProvider = createMarketDataProvider();

  constructor(
    private readonly repository: MarketDataRepository,
    private readonly cache: MarketDataCache,
  ) {}

  getProvider(): MarketDataProvider { return this.provider; }

  async onModuleInit(): Promise<void> {
    await this.repository.ensureSchema();
  }

  async history(symbol: string, from?: string, to?: string): Promise<HistoricalResponse> {
    const cached = await this.cache.get(symbol, from, to);
    if (cached) return cached;

    const stored = await this.repository.get(symbol, from, to);
    if (stored.length > 0) {
      const response: HistoricalResponse = {
        symbol: symbol.toUpperCase(), available: true, points: stored,
        source: { provider: 'postgres-cache', retrievedAt: new Date().toISOString() },
      };
      await this.cache.set(symbol, response, from, to);
      return response;
    }

    const response = await this.provider.stockHistory(symbol, from, to);
    if (response.available && response.points.length > 0 && response.source) {
      await this.repository.upsert(symbol, response.points, response.source.provider);
      await this.cache.set(symbol, response, from, to);
    }
    return response;
  }

  async onModuleDestroy(): Promise<void> {
    await this.cache.close();
    await this.repository.close();
  }
}
