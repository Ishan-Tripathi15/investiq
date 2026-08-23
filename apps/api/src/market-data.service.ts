import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { MarketDataCache } from './market-data.cache';
import { createMarketDataProvider, MarketDataProvider } from './market-data.provider';
import { MarketDataRepository } from './market-data.repository';
import { HistoricalResponse, InstrumentCatalogResponse, InstrumentSearchResponse, QuoteResponse } from './market-data.types';
import { StockDetailResponse } from './stock-detail.types';

@Injectable()
export class MarketDataService implements OnModuleInit, OnModuleDestroy {
  private readonly provider: MarketDataProvider = createMarketDataProvider();

  constructor(private readonly repository: MarketDataRepository, private readonly cache: MarketDataCache) {}

  getProvider(): MarketDataProvider { return this.provider; }

  async onModuleInit(): Promise<void> { await this.repository.ensureSchema(); }

  async history(symbol: string, from?: string, to?: string): Promise<HistoricalResponse> {
    const cached = await this.cache.get(symbol, from, to);
    if (cached) return cached;
    const stored = await this.repository.get(symbol, from, to);
    if (stored.length > 0) {
      const response: HistoricalResponse = { symbol: symbol.toUpperCase(), available: true, points: stored, source: { provider: 'postgres-cache', retrievedAt: new Date().toISOString() } };
      await this.cache.set(symbol, response, from, to);
      return response;
    }
    const response = await this.provider.stockHistory(symbol, from, to);
    if (response.available && response.points.length > 0 && response.source) {
      await this.repository.upsert(symbol, response.points, response.source.provider);
      await this.cache.set(symbol, response, from, to);
    }
    return response;
  }

  async quote(symbol: string): Promise<QuoteResponse> { return this.provider.quote(symbol); }

  async searchInstruments(query: string, country = 'India'): Promise<InstrumentSearchResponse> { return this.provider.searchInstruments(query, country); }

  async listInstruments(country = 'India', type = 'Common Stock', page = 1, pageSize = 100): Promise<InstrumentCatalogResponse> {
    return this.provider.listInstruments(country, type, page, pageSize);
  }

  async stockDetail(symbol: string, from?: string, to?: string): Promise<StockDetailResponse> {
    const normalized = symbol.trim().toUpperCase();
    if (!normalized) return { available: false, instrument: null, quote: null, history: [], source: null, message: 'A symbol is required.' };

    const [search, quote, history] = await Promise.all([
      this.provider.searchInstruments(normalized, 'India'),
      this.provider.quote(normalized),
      this.history(normalized, from, to),
    ]);

    const instrument = search.instruments.find((item) => item.symbol.toUpperCase() === normalized) ?? search.instruments[0] ?? null;
    const source = quote.quote?.source ?? history.source ?? search.source;
    const available = Boolean(instrument || quote.quote || history.available);
    const messages = [search.message, quote.message, history.message].filter(Boolean);

    return { available, instrument, quote: quote.quote, history: history.points, source, message: messages.length ? messages.join(' ') : undefined };
  }

  async onModuleDestroy(): Promise<void> { await this.cache.close(); await this.repository.close(); }
}
