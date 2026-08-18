import { Redis } from 'ioredis';
import { HistoricalResponse } from './market-data.types';

export class MarketDataCache {
  private readonly redis: Redis | null;
  private readonly ttlSeconds = Number(process.env.MARKET_DATA_CACHE_TTL_SECONDS ?? 300);

  constructor() {
    const url = process.env.REDIS_URL;
    this.redis = url ? new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: true }) : null;
  }

  private key(symbol: string, from?: string, to?: string): string {
    return `investiq:market:history:${symbol.toUpperCase()}:${from ?? 'start'}:${to ?? 'end'}`;
  }

  async get(symbol: string, from?: string, to?: string): Promise<HistoricalResponse | null> {
    if (!this.redis) return null;
    try {
      if (this.redis.status === 'wait') await this.redis.connect();
      const raw = await this.redis.get(this.key(symbol, from, to));
      return raw ? JSON.parse(raw) as HistoricalResponse : null;
    } catch {
      return null;
    }
  }

  async set(symbol: string, response: HistoricalResponse, from?: string, to?: string): Promise<void> {
    if (!this.redis || !response.available) return;
    try {
      if (this.redis.status === 'wait') await this.redis.connect();
      await this.redis.set(this.key(symbol, from, to), JSON.stringify(response), 'EX', this.ttlSeconds);
    } catch {
      // Cache failures must never make market-data requests fail.
    }
  }

  async close(): Promise<void> {
    if (this.redis) await this.redis.quit();
  }
}
