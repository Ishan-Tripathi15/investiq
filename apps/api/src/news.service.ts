import { Injectable } from '@nestjs/common';
import { createNewsProvider, NewsProvider } from './news.provider';
import { NewsResponse } from './news.types';
import { classifyNewsSentiment } from './news-sentiment';
import { NewsCache } from './news.cache';

@Injectable()
export class NewsService {
  private readonly provider: NewsProvider = createNewsProvider();
  private readonly cache = new NewsCache();

  private withSentiment(response: NewsResponse): NewsResponse {
    return { ...response, articles: response.articles.map(article => ({ ...article, sentiment: classifyNewsSentiment(article.title, article.description) })) };
  }

  async latest(query?: string, limit?: number): Promise<NewsResponse> {
    const cached = await this.cache.get(query, limit);
    if (cached) return cached;
    const response = this.withSentiment(await this.provider.latest(query, limit));
    await this.cache.set(query, limit, response);
    return response;
  }

  async stock(symbol: string, limit?: number): Promise<NewsResponse> {
    const query = `"${symbol}" stock OR shares OR results`;
    const cached = await this.cache.get(symbol, limit, true);
    if (cached) return cached;
    const response = this.withSentiment(await this.provider.latest(query, limit));
    await this.cache.set(symbol, limit, response, true);
    return response;
  }
}
