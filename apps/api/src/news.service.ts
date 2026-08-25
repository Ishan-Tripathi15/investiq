import { Injectable } from '@nestjs/common';
import { createNewsProvider, NewsProvider } from './news.provider';
import { NewsResponse } from './news.types';
import { classifyNewsSentiment } from './news-sentiment';

@Injectable()
export class NewsService {
  private readonly provider: NewsProvider = createNewsProvider();

  private withSentiment(response: NewsResponse): NewsResponse {
    return {
      ...response,
      articles: response.articles.map(article => ({
        ...article,
        sentiment: classifyNewsSentiment(article.title, article.description),
      })),
    };
  }

  async latest(query?: string, limit?: number): Promise<NewsResponse> {
    return this.withSentiment(await this.provider.latest(query, limit));
  }

  async stock(symbol: string, limit?: number): Promise<NewsResponse> {
    return this.withSentiment(await this.provider.latest(`"${symbol}" stock OR shares OR results`, limit));
  }
}