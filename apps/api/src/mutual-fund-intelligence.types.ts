export type FundIntelligenceBand = 'strong' | 'healthy' | 'mixed' | 'weak' | 'insufficient-data';

export interface FundIntelligenceResponse {
  schemeId: string;
  available: boolean;
  band: FundIntelligenceBand;
  score?: number;
  category?: string;
  latestNav?: number;
  returns?: { '1Y'?: number; '3Y'?: number; '5Y'?: number };
  volatilityPercent?: number;
  observations?: number;
  coveragePercent: number;
  source: { provider: string; retrievedAt: string } | null;
  message?: string;
}
