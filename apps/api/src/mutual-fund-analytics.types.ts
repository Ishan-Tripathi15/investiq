export interface FundAnalyticsResponse {
  schemeId: string;
  available: boolean;
  category?: string;
  expenseRatio?: number;
  aum?: number;
  benchmark?: string;
  riskLevel?: string;
  volatilityPercent?: number;
  source: { provider: string; retrievedAt: string } | null;
  message?: string;
}
