import { Injectable } from '@nestjs/common';
import { createNewsProvider, NewsProvider } from './news.provider';
import { NewsResponse } from './news.types';

@Injectable()
export class NewsService {
  private readonly provider: NewsProvider = createNewsProvider();

  async latest(query?: string, limit?: number): Promise<NewsResponse> {
    return this.provider.latest(query, limit);
  }
}
