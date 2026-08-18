import { HistoricalPoint, HistoricalResponse, MarketSource } from './market-data.types';

export interface MarketDataProvider {
  readonly name: string;
  health(): Promise<{ live: boolean; historical: boolean }>;
  stockHistory(symbol: string, from?: string, to?: string): Promise<HistoricalResponse>;
}

/**
 * Safe default provider. It intentionally returns no market values until a
 * verified vendor adapter is configured through the application boundary.
 */
export class UnconfiguredMarketDataProvider implements MarketDataProvider {
  readonly name = 'unconfigured';

  async health() {
    return { live: false, historical: false };
  }

  async stockHistory(symbol: string): Promise<HistoricalResponse> {
    const source: MarketSource | null = null;
    const points: HistoricalPoint[] = [];
    return {
      symbol: symbol.toUpperCase(),
      available: false,
      points,
      source,
      message: 'No verified market-data provider is configured.',
    };
  }
}
