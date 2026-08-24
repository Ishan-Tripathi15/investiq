import { MarketSource } from './market-data.types';

export interface MutualFundComparisonItem {
  schemeCode: string;
  schemeName: string;
  category?: string;
  nav?: number;
  navDate?: string;
  returnPercent?: number;
  performancePeriod: string;
  source: MarketSource | null;
  available: boolean;
  message?: string;
}

export interface MutualFundComparisonResponse {
  available: boolean;
  period: string;
  results: MutualFundComparisonItem[];
  message?: string;
}
