import { NewsArticle, NewsResponse } from './news.types';

export interface NewsProvider {
  latest(query?: string, limit?: number): Promise<NewsResponse>;
}

type GNewsItem = {
  title?: string;
  description?: string;
  url?: string;
  image?: string;
  publishedAt?: string;
  source?: { name?: string };
};

class GNewsProvider implements NewsProvider {
  private readonly apiKey = process.env.GNEWS_API_KEY;
  private readonly timeoutMs = 8_000;

  async latest(query = 'Indian stock market OR NSE OR BSE', limit = 20): Promise<NewsResponse> {
    const retrievedAt = new Date().toISOString();
    if (!this.apiKey) {
      return { available: false, articles: [], source: null, retrievedAt, message: 'Financial news provider is not configured.' };
    }

    const url = new URL('https://gnews.io/api/v4/search');
    url.searchParams.set('q', query);
    url.searchParams.set('lang', 'en');
    url.searchParams.set('country', 'in');
    url.searchParams.set('max', String(Math.min(Math.max(limit, 1), 50)));
    url.searchParams.set('apikey', this.apiKey);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        return { available: false, articles: [], source: 'gnews', retrievedAt, message: `News provider returned HTTP ${response.status}.` };
      }

      const data = await response.json() as { articles?: GNewsItem[] };
      const articles: NewsArticle[] = (data.articles ?? [])
        .filter((item): item is GNewsItem & { title: string; url: string } => {
          if (!item.title || !item.url) return false;
          try { const parsed = new URL(item.url); return parsed.protocol === 'http:' || parsed.protocol === 'https:'; } catch { return false; }
        })
        .map((item, index) => ({
          id: `${item.url}-${index}`,
          title: item.title,
          description: item.description,
          url: item.url,
          source: item.source?.name ?? 'Unknown source',
          publishedAt: item.publishedAt && Number.isFinite(new Date(item.publishedAt).getTime()) ? item.publishedAt : retrievedAt,
          imageUrl: item.image,
          category: query.toLowerCase().includes('stock') || query.toLowerCase().includes('nse') || query.toLowerCase().includes('bse') ? 'market' : 'company',
        }));

      return { available: articles.length > 0, articles, source: 'gnews', retrievedAt, message: articles.length ? undefined : 'No matching financial news was returned.' };
    } catch (error) {
      const message = error instanceof Error && error.name === 'AbortError' ? 'Financial news provider timed out.' : 'Unable to reach the financial news provider.';
      return { available: false, articles: [], source: 'gnews', retrievedAt, message };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createNewsProvider(): NewsProvider { return new GNewsProvider(); }
