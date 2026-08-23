import { HistoricalPoint, HistoricalResponse, InstrumentCatalogResponse, InstrumentSearchResponse, MarketInstrument, MarketSource, QuoteResponse } from './market-data.types';

export interface MarketDataProvider {
  readonly name: string;
  health(): Promise<{ live: boolean; historical: boolean }>;
  stockHistory(symbol: string, from?: string, to?: string): Promise<HistoricalResponse>;
  quote(symbol: string): Promise<QuoteResponse>;
  searchInstruments(query: string, country?: string): Promise<InstrumentSearchResponse>;
  listInstruments(country: string, type: string, page?: number, pageSize?: number): Promise<InstrumentCatalogResponse>;
}

export class UnconfiguredMarketDataProvider implements MarketDataProvider {
  readonly name = 'unconfigured';
  async health() { return { live: false, historical: false }; }
  async stockHistory(symbol: string): Promise<HistoricalResponse> {
    return { symbol: symbol.toUpperCase(), available: false, points: [], source: null, message: 'No verified market-data provider is configured.' };
  }
  async quote(symbol: string): Promise<QuoteResponse> {
    return { symbol: symbol.toUpperCase(), available: false, quote: null, message: 'No verified live market-data provider is configured.' };
  }
  async searchInstruments(query: string): Promise<InstrumentSearchResponse> {
    return { query, instruments: [], source: null, available: false, message: 'No verified market-data provider is configured.' };
  }
  async listInstruments(country: string, type: string, page = 1, pageSize = 100): Promise<InstrumentCatalogResponse> {
    return { country, type, page, pageSize, instruments: [], source: null, available: false, message: 'No verified market-data provider is configured.' };
  }
}

interface TwelveDataResponse { status?: string; message?: string; meta?: { symbol?: string }; values?: Array<{ datetime: string; open?: string; high?: string; low?: string; close: string; volume?: string }>; }
interface TwelveDataInstrument { symbol?: string; name?: string; instrument_name?: string; currency?: string; exchange?: string; mic_code?: string; country?: string; type?: string; instrument_type?: string; }
interface TwelveDataInstrumentResponse { status?: string; message?: string; count?: number; data?: TwelveDataInstrument[]; }
interface TwelveDataQuoteResponse { status?: string; message?: string; symbol?: string; name?: string; exchange?: string; currency?: string; close?: string; previous_close?: string; change?: string; percent_change?: string; open?: string; high?: string; low?: string; volume?: string; is_market_open?: boolean; datetime?: string; }

export class TwelveDataProvider implements MarketDataProvider {
  readonly name = 'twelve-data';
  private readonly apiKey = process.env.TWELVE_DATA_API_KEY;
  private readonly baseUrl = process.env.TWELVE_DATA_BASE_URL ?? 'https://api.twelvedata.com';
  private readonly timeoutMs = Number(process.env.MARKET_DATA_TIMEOUT_MS ?? 8000);

  async health() { return { live: Boolean(this.apiKey), historical: Boolean(this.apiKey) }; }

  private async get<T>(path: string, params: Record<string, string>): Promise<T> {
    if (!this.apiKey) throw new Error('No verified market-data provider is configured.');
    const url = new URL(path, this.baseUrl);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    url.searchParams.set('apikey', this.apiKey);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      const body = await response.json() as T;
      if (!response.ok) throw new Error(`Market provider returned HTTP ${response.status}`);
      return body;
    } finally { clearTimeout(timeout); }
  }

  async stockHistory(symbol: string, from?: string, to?: string): Promise<HistoricalResponse> {
    if (!this.apiKey) return new UnconfiguredMarketDataProvider().stockHistory(symbol);
    try {
      const params: Record<string, string> = { symbol: symbol.toUpperCase(), interval: '1day', adjust: 'all' };
      if (from) params.start_date = from;
      if (to) params.end_date = to;
      if (!from && !to) params.outputsize = '5000';
      const body = await this.get<TwelveDataResponse>('/time_series', params);
      if (body.status === 'error' || !body.values) throw new Error(body.message ?? 'Market provider returned no historical data.');
      const points: HistoricalPoint[] = body.values.map((value) => ({ timestamp: new Date(value.datetime).toISOString(), open: value.open == null ? undefined : Number(value.open), high: value.high == null ? undefined : Number(value.high), low: value.low == null ? undefined : Number(value.low), close: Number(value.close), volume: value.volume == null ? undefined : Number(value.volume) }));
      const source: MarketSource = { provider: this.name, retrievedAt: new Date().toISOString() };
      return { symbol: symbol.toUpperCase(), available: points.length > 0, points, source };
    } catch (error) {
      return { symbol: symbol.toUpperCase(), available: false, points: [], source: null, message: error instanceof Error ? error.message : 'Market provider request failed.' };
    }
  }

  async quote(symbol: string): Promise<QuoteResponse> {
    const normalized = symbol.trim().toUpperCase();
    if (!normalized) return { symbol: '', available: false, quote: null, message: 'A symbol is required.' };
    if (!this.apiKey) return new UnconfiguredMarketDataProvider().quote(normalized);
    try {
      const body = await this.get<TwelveDataQuoteResponse>('/quote', { symbol: normalized });
      if (body.status === 'error' || body.close == null) throw new Error(body.message ?? 'Market provider returned no live quote.');
      const price = Number(body.close);
      if (!Number.isFinite(price)) throw new Error('Market provider returned an invalid quote price.');
      const source: MarketSource = { provider: this.name, retrievedAt: new Date().toISOString() };
      return { symbol: body.symbol?.toUpperCase() ?? normalized, available: true, quote: { symbol: body.symbol?.toUpperCase() ?? normalized, name: body.name, exchange: body.exchange, currency: body.currency, price, previousClose: this.numberOrUndefined(body.previous_close), change: this.numberOrUndefined(body.change), changePercent: this.numberOrUndefined(body.percent_change), open: this.numberOrUndefined(body.open), high: this.numberOrUndefined(body.high), low: this.numberOrUndefined(body.low), volume: this.numberOrUndefined(body.volume), isMarketOpen: body.is_market_open, timestamp: body.datetime ? new Date(body.datetime).toISOString() : source.retrievedAt, source } };
    } catch (error) {
      return { symbol: normalized, available: false, quote: null, message: error instanceof Error ? error.message : 'Live quote request failed.' };
    }
  }

  private mapInstrument(row: TwelveDataInstrument): MarketInstrument | null {
    const symbol = row.symbol?.trim();
    const name = (row.instrument_name ?? row.name)?.trim();
    if (!symbol || !name || !row.exchange || !row.country || !row.currency) return null;
    return { symbol, name, exchange: row.exchange, micCode: row.mic_code, country: row.country, currency: row.currency, type: row.instrument_type ?? row.type ?? 'Unknown' };
  }

  async searchInstruments(query: string, country = 'India'): Promise<InstrumentSearchResponse> {
    const normalized = query.trim();
    if (!normalized) return { query: '', instruments: [], source: null, available: true, message: 'Enter a company name or symbol to search.' };
    if (!this.apiKey) return new UnconfiguredMarketDataProvider().searchInstruments(normalized);
    try {
      const body = await this.get<TwelveDataInstrumentResponse>('/symbol_search', { symbol: normalized, outputsize: '120' });
      if (body.status === 'error' || !body.data) throw new Error(body.message ?? 'Instrument search failed.');
      const instruments = body.data.map((row) => this.mapInstrument(row)).filter((row): row is MarketInstrument => Boolean(row)).filter((row) => row.country.toLowerCase() === country.toLowerCase());
      return { query: normalized, instruments, available: true, source: { provider: this.name, retrievedAt: new Date().toISOString() } };
    } catch (error) { return { query: normalized, instruments: [], available: false, source: null, message: error instanceof Error ? error.message : 'Instrument search failed.' }; }
  }

  async listInstruments(country = 'India', type = 'Common Stock', page = 1, pageSize = 100): Promise<InstrumentCatalogResponse> {
    if (!this.apiKey) return new UnconfiguredMarketDataProvider().listInstruments(country, type, page, pageSize);
    const safePage = Math.max(1, Math.floor(page));
    const safeSize = Math.min(5000, Math.max(1, Math.floor(pageSize)));
    try {
      const body = await this.get<TwelveDataInstrumentResponse>('/stocks', { country, type, page: String(safePage), outputsize: String(safeSize) });
      if (body.status === 'error' || !body.data) throw new Error(body.message ?? 'Instrument catalog unavailable.');
      const instruments = body.data.map((row) => this.mapInstrument(row)).filter((row): row is MarketInstrument => Boolean(row));
      return { country, type, page: safePage, pageSize: safeSize, instruments, available: true, source: { provider: this.name, retrievedAt: new Date().toISOString() } };
    } catch (error) { return { country, type, page: safePage, pageSize: safeSize, instruments: [], available: false, source: null, message: error instanceof Error ? error.message : 'Instrument catalog request failed.' }; }
  }

  private numberOrUndefined(value?: string): number | undefined {
    if (value === undefined) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
}

export function createMarketDataProvider(): MarketDataProvider {
  return process.env.TWELVE_DATA_API_KEY ? new TwelveDataProvider() : new UnconfiguredMarketDataProvider();
}
