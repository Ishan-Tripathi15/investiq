export interface HistoricalValuationRecord {
  fiscalDate: string;
  marketCap?: number;
  pe?: number;
  pb?: number;
  ps?: number;
  evToEbitda?: number;
  marketCapDate?: string;
}

export interface HistoricalValuationResponse {
  symbol: string;
  available: boolean;
  points: HistoricalValuationRecord[];
  source: { provider: string; retrievedAt: string } | null;
  message?: string;
}
