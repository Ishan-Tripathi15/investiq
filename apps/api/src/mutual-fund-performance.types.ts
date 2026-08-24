import { FundHistoricalPoint } from './mutual-funds.types';

export type FundPerformancePeriod = '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y' | 'MAX';

export interface FundPerformanceResponse {
  schemeId: string;
  period: FundPerformancePeriod;
  available: boolean;
  points: FundHistoricalPoint[];
  startNav?: number;
  endNav?: number;
  returnPercent?: number;
  source: { provider: string; retrievedAt: string } | null;
  message?: string;
}
