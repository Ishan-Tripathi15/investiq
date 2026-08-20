export type PortfolioRiskLevel = 'low' | 'moderate' | 'high' | 'critical';

export interface PortfolioHolding {
  symbol: string;
  marketValue: number;
  sector?: string;
  beta?: number;
}

export interface PortfolioProfile {
  riskTolerance?: 'conservative' | 'moderate' | 'aggressive';
  dailyLossLimitPct?: number;
  maxDrawdownPct?: number;
}

export interface PortfolioIntelligence {
  equity: number;
  investedValue: number;
  cashValue: number;
  cashPct: number;
  concentrationPct: number;
  largestPosition?: { symbol: string; weightPct: number };
  sectorExposure: Array<{ sector: string; marketValue: number; weightPct: number }>;
  betaWeighted?: number;
  riskLevel: PortfolioRiskLevel;
  warnings: string[];
  actions: string[];
}

function nonNegative(name: string, value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be non-negative`);
  return value;
}

export function buildPortfolioIntelligence(
  equityInput: number,
  cashInput: number,
  holdingsInput: PortfolioHolding[],
  profile: PortfolioProfile = {},
): PortfolioIntelligence {
  const equity = nonNegative('Equity', equityInput);
  const cash = Math.min(nonNegative('Cash', cashInput), equity);
  const holdings = holdingsInput
    .filter((holding) => Number.isFinite(holding.marketValue) && holding.marketValue > 0)
    .map((holding) => ({ ...holding, symbol: holding.symbol.trim().toUpperCase() }));
  const investedValue = holdings.reduce((sum, holding) => sum + holding.marketValue, 0);
  const largest = holdings.reduce<PortfolioHolding | undefined>((best, holding) => !best || holding.marketValue > best.marketValue ? holding : best, undefined);
  const concentrationPct = equity > 0 && largest ? (largest.marketValue / equity) * 100 : 0;

  const sectors = new Map<string, number>();
  for (const holding of holdings) {
    const sector = holding.sector?.trim() || 'Unknown';
    sectors.set(sector, (sectors.get(sector) ?? 0) + holding.marketValue);
  }
  const sectorExposure = [...sectors.entries()]
    .map(([sector, marketValue]) => ({ sector, marketValue, weightPct: equity > 0 ? (marketValue / equity) * 100 : 0 }))
    .sort((a, b) => b.marketValue - a.marketValue);

  const betaValues = holdings.filter((holding) => holding.beta !== undefined && Number.isFinite(holding.beta));
  const betaWeighted = investedValue > 0 && betaValues.length > 0
    ? betaValues.reduce((sum, holding) => sum + (holding.beta as number) * holding.marketValue, 0) / investedValue
    : undefined;

  const warnings: string[] = [];
  const actions: string[] = [];
  if (concentrationPct > 40) warnings.push('Single-position concentration is above 40% of equity.');
  else if (concentrationPct > 25) warnings.push('Largest position is above 25% of equity.');
  if (cash < equity * 0.05 && investedValue > 0) warnings.push('Cash buffer is below 5% of equity.');
  const largestSector = sectorExposure[0];
  if (largestSector && largestSector.weightPct > 50) warnings.push(`${largestSector.sector} exposure is above 50% of equity.`);
  if (betaWeighted !== undefined && betaWeighted > 1.3) warnings.push('Portfolio beta is elevated versus a beta-one market exposure.');
  if (profile.riskTolerance === 'conservative' && (concentrationPct > 25 || (betaWeighted ?? 0) > 1.1)) warnings.push('Current exposure may be inconsistent with the selected conservative risk profile.');

  if (concentrationPct > 40) actions.push('Review the largest position and consider diversification before increasing exposure.');
  if (cash < equity * 0.05 && investedValue > 0) actions.push('Maintain a larger liquidity buffer for planned withdrawals and risk events.');
  if (largestSector && largestSector.weightPct > 50) actions.push('Review sector concentration and correlated holdings.');
  if (warnings.length === 0) actions.push('No material concentration or liquidity warning was detected from the supplied verified holdings.');

  const severity = Math.max(
    concentrationPct > 40 ? 3 : concentrationPct > 25 ? 2 : 0,
    largestSector?.weightPct && largestSector.weightPct > 50 ? 2 : 0,
    betaWeighted !== undefined && betaWeighted > 1.5 ? 2 : betaWeighted !== undefined && betaWeighted > 1.3 ? 1 : 0,
    cash < equity * 0.05 && investedValue > 0 ? 1 : 0,
  );
  const riskLevel: PortfolioRiskLevel = severity >= 3 ? 'critical' : severity === 2 ? 'high' : severity === 1 ? 'moderate' : 'low';

  return {
    equity,
    investedValue,
    cashValue: cash,
    cashPct: equity > 0 ? (cash / equity) * 100 : 0,
    concentrationPct,
    ...(largest ? { largestPosition: { symbol: largest.symbol, weightPct: concentrationPct } } : {}),
    sectorExposure,
    ...(betaWeighted !== undefined ? { betaWeighted } : {}),
    riskLevel,
    warnings,
    actions,
  };
}
