export interface FinancialPeriod {
  fiscalDate: string;
  revenue?: number;
  grossProfit?: number;
  ebit?: number;
  ebitda?: number;
  netIncome?: number;
  eps?: number;
  operatingCashFlow?: number;
  freeCashFlow?: number;
  totalDebt?: number;
  totalCash?: number;
  roe?: number;
  roce?: number;
  grossMarginPct?: number;
  operatingMarginPct?: number;
  netMarginPct?: number;
}

export interface FundamentalSnapshot {
  symbol: string;
  name?: string;
  currency?: string;
  exchange?: string;
  marketCap?: number;
  enterpriseValue?: number;
  pe?: number;
  forwardPe?: number;
  peg?: number;
  priceToSales?: number;
  priceToBook?: number;
  evToRevenue?: number;
  evToEbitda?: number;
  revenue?: number;
  ebitda?: number;
  netIncome?: number;
  eps?: number;
  operatingCashFlow?: number;
  freeCashFlow?: number;
  totalDebt?: number;
  totalCash?: number;
  roe?: number;
  roa?: number;
  grossMarginPct?: number;
  operatingMarginPct?: number;
  netMarginPct?: number;
  insiderOwnershipPct?: number;
  institutionalOwnershipPct?: number;
  periods: FinancialPeriod[];
}

export interface FundamentalsResponse {
  symbol: string;
  available: boolean;
  data: FundamentalSnapshot | null;
  source: { provider: string; retrievedAt: string } | null;
  message?: string;
}
