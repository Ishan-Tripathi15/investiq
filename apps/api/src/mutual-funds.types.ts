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

export interface FundScheme {
  schemeCode: string;
  isinGrowth?: string;
  isinReinvestment?: string;
  schemeName: string;
  nav?: number;
  date?: string;
  category?: string;
}

export interface FundSchemeSearchResponse {
  query: string;
  available: boolean;
  results: FundScheme[];
  source: { provider: string; retrievedAt: string } | null;
  message?: string;
}
