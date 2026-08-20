export type RiskTwinScenario = 'drawdown_5' | 'drawdown_10' | 'drawdown_20' | 'gap_down_12' | 'volatility_shock' | 'bear_regime';

export interface RiskTwinPosition {
  symbol: string;
  marketValue: number;
  beta?: number;
  sector?: string;
}

export interface RiskTwinInput {
  equity: number;
  availableCash: number;
  positions: RiskTwinPosition[];
  dailyLossLimitPct?: number;
  maxDrawdownPct?: number;
}

export interface RiskTwinScenarioResult {
  scenario: RiskTwinScenario;
  portfolioValueAfter: number;
  lossAmount: number;
  lossPct: number;
  breachedDailyLimit: boolean;
  breachedDrawdownLimit: boolean;
  warnings: string[];
}

export interface RiskTwinSummary {
  equity: number;
  investedValue: number;
  cashPct: number;
  concentrationPct: number;
  largestPosition?: { symbol: string; weightPct: number };
  scenarios: RiskTwinScenarioResult[];
  warnings: string[];
}

function finiteNonNegative(name: string, value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be non-negative`);
  return value;
}

export function buildRiskTwin(input: RiskTwinInput): RiskTwinSummary {
  const equity = finiteNonNegative('Equity', input.equity);
  const cash = Math.min(finiteNonNegative('Available cash', input.availableCash), equity);
  const positions = input.positions.filter((position) => position.marketValue > 0).map((position) => ({ ...position, symbol: position.symbol.trim().toUpperCase() }));
  const investedValue = positions.reduce((sum, position) => sum + position.marketValue, 0);
  const largest = positions.reduce<RiskTwinPosition | undefined>((best, position) => !best || position.marketValue > best.marketValue ? position : best, undefined);
  const largestWeight = equity > 0 && largest ? (largest.marketValue / equity) * 100 : 0;
  const dailyLimit = input.dailyLossLimitPct ?? 2;
  const drawdownLimit = input.maxDrawdownPct ?? 20;
  const scenarios: Array<[RiskTwinScenario, number]> = [
    ['drawdown_5', 0.05], ['drawdown_10', 0.10], ['drawdown_20', 0.20], ['gap_down_12', 0.12],
    ['volatility_shock', 0.15], ['bear_regime', 0.25],
  ];
  const results = scenarios.map(([scenario, shock]) => {
    const lossAmount = investedValue * shock;
    const after = Math.max(0, equity - lossAmount);
    const lossPct = equity > 0 ? (lossAmount / equity) * 100 : 0;
    const warnings: string[] = [];
    if (lossPct >= dailyLimit) warnings.push('Scenario exceeds the configured daily-loss limit.');
    if (lossPct >= drawdownLimit) warnings.push('Scenario exceeds the configured maximum drawdown limit.');
    return { scenario, portfolioValueAfter: after, lossAmount, lossPct, breachedDailyLimit: lossPct >= dailyLimit, breachedDrawdownLimit: lossPct >= drawdownLimit, warnings };
  });
  const warnings: string[] = [];
  if (largestWeight > 25) warnings.push('Largest position exceeds 25% of equity; concentration risk is elevated.');
  if (cash < equity * 0.05 && investedValue > 0) warnings.push('Cash buffer is below 5% of equity.');
  return { equity, investedValue, cashPct: equity > 0 ? (cash / equity) * 100 : 0, concentrationPct: largestWeight, ...(largest ? { largestPosition: { symbol: largest.symbol, weightPct: largestWeight } } : {}), scenarios: results, warnings };
}
