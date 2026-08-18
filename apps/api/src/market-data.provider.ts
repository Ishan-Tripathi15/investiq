import { HistoricalPoint, HistoricalResponse, MarketSource } from './market-data.types';

export interface MarketDataProvider {
  readonly name: string;
  health(): Promise<{ live: boolean; historical: boolean }>;
  stockHistory(symbol: string, from?: string, to?: string): Promise<HistoricalResponse>;
}

export class UnconfiguredMarketDataProvider implements MarketDataProvider {
  readonly name = 'unconfigured';

  async health() {
    return { live: false, historical: false };
  }

  async stockHistory(symbol: string): Promise<HistoricalResponse> {
    return {
      symbol: symbol.toUpperCase(), available: false, points: [], source: null,
      message: 'No verified market-data provider is configured.',
    };
  }
}

interface TwelveDataResponse {
  status?: string;
  message?: string;
  meta?: { symbol?: string };
  values?: Array<{
    datetime: string; open?: string; high?: string; low?: string; close: string; volume?: string;
  }>;
}

export class TwelveDataProvider implements MarketDataProvider {
  readonly name = 'twelve-data';
  private readonly apiKey = process.env.TWELVE_DATA_API_KEY;
  private readonly baseUrl = process.env.TWELVE_DATA_BASE_URL ?? 'https://api.twelvedata.com';
  private readonly timeoutMs = Number(process.env.MARKET_DATA_TIMEOUT_MS ?? 8000);

  async health() {
    return { live: Boolean(this.apiKey), historical: Boolean(this.apiKey) };
  }

  async stockHistory(symbol: string, from?: string, to?: string): Promise<HistoricalResponse> {
    if (!this.apiKey) return new UnconfiguredMarketDataProvider().stockHistory(symbol);

    const url = new URL('/time_series', this.baseUrl);
    url.searchParams.set('symbol', symbol.toUpperCase());
    url.searchParams.set('interval', '1day');
    url.searchParams.set('adjust', 'all');
    url.searchParams.set('apikey', this.apiKey);
    if (from) url.searchParams.set('start_date', from);
    if (to) url.searchParams.set('end_date', to);
    if (!from && !to) url.searchParams.set('outputsize', '5000');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      const body = await response.json() as TwelveDataResponse;
      if (!response.ok || body.status === 'error' || !body.values) {
        throw new Error(body.message ?? `Market provider returned HTTP ${response.status}`);
      }

      const points: HistoricalPoint[] = body.values.map((value) => ({
        timestamp: new Date(value.datetime).toISOString(),
        open: value.open == null ? undefined : Number(value.open),
        high: value.high == null ? undefined : Number(value.high),
        low: value.low == null ? undefined : Number(value.low),
        close: Number(value.close),
        volume: value.volume == null ? undefined : Number(value.volume),
      }));

      const source: MarketSource = { provider: this.name, retrievedAt: new Date().toISOString() };
      return { symbol: symbol.toUpperCase(), available: points.length > 0, points, source };
    } catch (error) {
      return {
        symbol: symbol.toUpperCase(), available: false, points: [], source: null,
        message: error instanceof Error ? error.message : 'Market provider request failed.',
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createMarketDataProvider(): MarketDataProvider {
  return process.env.TWELVE_DATA_API_KEY
    ? new TwelveDataProvider()
    : new UnconfiguredMarketDataProvider();
}
