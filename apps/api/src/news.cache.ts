import { Redis } from 'ioredis';
import { NewsResponse } from './news.types';

export class NewsCache {
  private readonly redis: Redis | null;
  private readonly ttlSeconds = Number(process.env.NEWS_CACHE_TTL_SECONDS ?? 120);

  constructor() {
    const url = process.env.REDIS_URL;
    this.redis = url ? new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: true }) : null;
  }

  private key(query: string | undefined, limit: number | undefined, stock = false) {
    return `investiq:news:${stock ? 'stock' : 'latest'}:${encodeURIComponent(query ?? '')}:${limit ?? 'default'}`;
  }

  async get(query?: string, limit?: number, stock = false): Promise<NewsResponse | null> {
    if (!this.redis) return null;
    try {
      if (this.redis.status === 'wait') await this.redis.connect();
      const raw = await this.redis.get(this.key(query, limit, stock));
      return raw ? JSON.parse(raw) as NewsResponse : null;
    } catch { return null; }
  }

  async set(query: string | undefined, limit: number | undefined, response: NewsResponse, stock = false): Promise<void> {
    if (!this.redis || !response.available) return;
    try {
      if (this.redis.status === 'wait') await this.redis.connect();
      await this.redis.set(this.key(query, limit, stock), JSON.stringify(response), 'EX', this.ttlSeconds);
    } catch { /* cache failures must never fail news requests */ }
  }

  async close() { if (this.redis) await this.redis.quit(); }
}
