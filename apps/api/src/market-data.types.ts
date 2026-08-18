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
