export interface FundHistoricalPoint {
  timestamp: string;
  nav: number;
}

export interface FundHistoricalResponse {
  schemeId: string;
  available: boolean;
  points: FundHistoricalPoint[];
  source: { provider: string; retrievedAt: string } | null;
  message?: string;
}
