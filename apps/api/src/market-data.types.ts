export interface MarketSource {
  provider: string;
  retrievedAt: string;
}

export interface HistoricalPoint {
  timestamp: string;
  open?: number;
  high?: number;
  low?: number;
  close: number;
  volume?: number;
}

export interface HistoricalResponse {
  symbol: string;
  available: boolean;
  points: HistoricalPoint[];
  source: MarketSource | null;
  message?: string;
}

export interface MarketInstrument {
  symbol: string;
  name: string;
  exchange: string;
  micCode?: string;
  country: string;
  currency: string;
  type: string;
}

export interface InstrumentSearchResponse {
  query: string;
  instruments: MarketInstrument[];
  source: MarketSource | null;
  available: boolean;
  message?: string;
}

export interface InstrumentCatalogResponse {
  country: string;
  type: string;
  page: number;
  pageSize: number;
  instruments: MarketInstrument[];
  source: MarketSource | null;
  available: boolean;
  message?: string;
}
