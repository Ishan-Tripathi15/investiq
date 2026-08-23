import { HistoricalPoint, LiveQuote, MarketInstrument, MarketSource } from './market-data.types';

export interface StockDetailResponse {
  available: boolean;
  instrument: MarketInstrument | null;
  quote: LiveQuote | null;
  history: HistoricalPoint[];
  source: MarketSource | null;
  message?: string;
}
