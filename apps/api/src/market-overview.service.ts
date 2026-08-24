import { Injectable } from '@nestjs/common';
import { MarketDataService } from './market-data.service';
import { MarketOverviewResponse } from './market-overview.types';

@Injectable()
export class MarketOverviewService {
  constructor(private readonly marketData: MarketDataService) {}

  async overview(): Promise<MarketOverviewResponse> {
    const symbols = (process.env.MARKET_INDEX_SYMBOLS ?? 'NIFTY,SENSEX').split(',').map((value) => value.trim().toUpperCase()).filter(Boolean).slice(0, 6);
    const responses = await Promise.all(symbols.map((symbol) => this.marketData.quote(symbol)));
    const indices = responses.filter((response) => response.available && response.quote).map((response) => {
      const quote = response.quote!;
      return { symbol: quote.symbol, name: quote.name ?? quote.symbol, value: quote.price, change: quote.change, changePercent: quote.changePercent, currency: quote.currency, timestamp: quote.timestamp, source: quote.source };
    });
    const sources = indices.map((index) => index.source).filter(Boolean);
    const source = sources[0] ?? null;
    const marketOpen = responses.find((response) => response.quote?.isMarketOpen !== undefined)?.quote?.isMarketOpen ?? null;
    const messages = responses.map((response) => response.message).filter(Boolean);
    return { available: indices.length > 0, marketOpen, indices, gainers: [], losers: [], active: [], source, message: indices.length ? undefined : messages.join(' ') || 'Verified market indices are currently unavailable.' };
  }
}
