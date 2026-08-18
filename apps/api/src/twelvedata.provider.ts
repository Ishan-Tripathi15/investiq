import { HistoricalPoint, HistoricalResponse, MarketSource } from './market-data.types';
import { MarketDataProvider } from './market-data.provider';

interface TwelveDataResponse {
  status?: string;
  code?: number;
  message?: string;
  values?: Array<{
    datetime: string;
    open?: string;
    high?: string;
    low?: string;
    close: string;
    volume?: string;
  }>;
}

export class TwelveDataProvider implements MarketDataProvider {
  readonly name = 'twelve-data';
  private readonly baseUrl = process.env.TWELVE_DATA_BASE_URL ?? 'https://api.twelvedata.com';
  private readonly apiKey = process.env.TWELVE_DATA_API_KEY;
  private readonly timeoutMs = Number(process.env.MARKET_DATA_TIMEOUT_MS ?? 8000);

  async health() {
    return { live: Boolean(this.apiKey), historical: Boolean(this.apiKey) };
  }

  async stockHistory(symbol: string, from?: string, to?: string): Promise<HistoricalResponse> {
    if (!this.apiKey) {
      return {
        symbol: symbol.toUpperCase(),
        available: false,
        points: [],
        source: null,
        message: 'TWELVE_DATA_API_KEY is not configured.',
      };
    }

    const params = new URLSearchParams({
      symbol,
      interval: '1day',
      apikey: this.apiKey,
      order: 'asc',
      adjust: 'all',
      outputsize: '5000',
    });
    if (from) params.set('start_date', from);
    if (to) params.set('end_date', to);

    const response = await this.request(`${this.baseUrl}/time_series?${params.toString()}`);
    const payload = (await response.json()) as TwelveDataResponse;

    if (!response.ok || payload.status === 'error' || !Array.isArray(payload.values)) {
      return {
        symbol: symbol.toUpperCase(),
        available: false,
        points: [],
        source: this.source(),
        message: payload.message ?? `Market provider request failed with HTTP ${response.status}.`,
      };
    }

    const points: HistoricalPoint[] = payload.values
      .map((point) => ({
        timestamp: point.datetime,
        open: this.numberOrUndefined(point.open),
        high: this.numberOrUndefined(point.high),
        low: this.numberOrUndefined(point.low),
        close: Number(point.close),
        volume: this.numberOrUndefined(point.volume),
      }))
      .filter((point) => Number.isFinite(point.close));

    return {
      symbol: symbol.toUpperCase(),
      available: points.length > 0,
      points,
      source: this.source(),
      message: points.length ? undefined : 'Provider returned no historical points.',
    };
  }

  private source(): MarketSource {
    return { provider: this.name, retrievedAt: new Date().toISOString() };
  }

  private numberOrUndefined(value?: string): number | undefined {
    if (value === undefined) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private async request(url: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }
}
