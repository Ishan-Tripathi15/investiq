import { HistoricalPoint, HistoricalResponse, InstrumentCatalogResponse, InstrumentSearchResponse, MarketInstrument, MarketSource } from './market-data.types';
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

interface TwelveDataInstrument {
  symbol?: string;
  name?: string;
  instrument_name?: string;
  currency?: string;
  exchange?: string;
  mic_code?: string;
  country?: string;
  type?: string;
  instrument_type?: string;
}

interface TwelveDataInstrumentResponse {
  status?: string;
  message?: string;
  data?: TwelveDataInstrument[];
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

  async searchInstruments(query: string, country = 'India'): Promise<InstrumentSearchResponse> {
    const normalized = query.trim();
    if (!normalized) {
      return { query: '', instruments: [], source: null, available: true, message: 'Enter a company name or symbol to search.' };
    }
    if (!this.apiKey) return this.unconfiguredSearch(normalized);

    try {
      const url = new URL('/symbol_search', this.baseUrl);
      url.searchParams.set('symbol', normalized);
      url.searchParams.set('outputsize', '120');
      url.searchParams.set('apikey', this.apiKey);
      const response = await this.request(url.toString());
      const body = (await response.json()) as TwelveDataInstrumentResponse;
      if (!response.ok || body.status === 'error' || !Array.isArray(body.data)) {
        throw new Error(body.message ?? `Instrument search failed with HTTP ${response.status}.`);
      }
      const instruments = body.data
        .map((row) => this.mapInstrument(row))
        .filter((row): row is MarketInstrument => Boolean(row))
        .filter((row) => row.country.toLowerCase() === country.toLowerCase());
      return { query: normalized, instruments, available: true, source: this.source() };
    } catch (error) {
      return { query: normalized, instruments: [], available: false, source: null, message: error instanceof Error ? error.message : 'Instrument search failed.' };
    }
  }

  async listInstruments(country = 'India', type = 'Common Stock', page = 1, pageSize = 100): Promise<InstrumentCatalogResponse> {
    if (!this.apiKey) return this.unconfiguredCatalog(country, type, page, pageSize);
    const safePage = Math.max(1, Math.floor(page));
    const safeSize = Math.min(5000, Math.max(1, Math.floor(pageSize)));

    try {
      const url = new URL('/stocks', this.baseUrl);
      url.searchParams.set('country', country);
      url.searchParams.set('type', type);
      url.searchParams.set('page', String(safePage));
      url.searchParams.set('outputsize', String(safeSize));
      url.searchParams.set('apikey', this.apiKey);
      const response = await this.request(url.toString());
      const body = (await response.json()) as TwelveDataInstrumentResponse;
      if (!response.ok || body.status === 'error' || !Array.isArray(body.data)) {
        throw new Error(body.message ?? `Instrument catalog request failed with HTTP ${response.status}.`);
      }
      const instruments = body.data.map((row) => this.mapInstrument(row)).filter((row): row is MarketInstrument => Boolean(row));
      return { country, type, page: safePage, pageSize: safeSize, instruments, available: true, source: this.source() };
    } catch (error) {
      return { country, type, page: safePage, pageSize: safeSize, instruments: [], available: false, source: null, message: error instanceof Error ? error.message : 'Instrument catalog request failed.' };
    }
  }

  private mapInstrument(row: TwelveDataInstrument): MarketInstrument | null {
    const symbol = row.symbol?.trim();
    const name = (row.instrument_name ?? row.name)?.trim();
    if (!symbol || !name || !row.exchange || !row.country || !row.currency) return null;
    return {
      symbol,
      name,
      exchange: row.exchange,
      micCode: row.mic_code,
      country: row.country,
      currency: row.currency,
      type: row.instrument_type ?? row.type ?? 'Unknown',
    };
  }

  private source(): MarketSource {
    return { provider: this.name, retrievedAt: new Date().toISOString() };
  }

  private unconfiguredSearch(query: string): InstrumentSearchResponse {
    return { query, instruments: [], source: null, available: false, message: 'TWELVE_DATA_API_KEY is not configured.' };
  }

  private unconfiguredCatalog(country: string, type: string, page: number, pageSize: number): InstrumentCatalogResponse {
    return { country, type, page, pageSize, instruments: [], source: null, available: false, message: 'TWELVE_DATA_API_KEY is not configured.' };
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
