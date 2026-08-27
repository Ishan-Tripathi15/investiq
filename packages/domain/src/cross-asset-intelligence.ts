export type AssetClass = 'stock' | 'mutual_fund' | 'cash';

export interface CrossAssetHolding {
  symbol: string;
  assetClass: AssetClass;
  marketValue: number;
  expectedAnnualReturnPct?: number;
}

export interface FinancialGoal {
  name: string;
  targetValue: number;
  years: number;
  priority?: 'low' | 'medium' | 'high';
}

export interface CrossAssetIntelligenceInput {
  holdings: CrossAssetHolding[];
  goals: FinancialGoal[];
  monthlyContribution?: number;
  assumedAnnualReturnPct?: number;
}

export interface GoalFundingGap {
  name: string;
  priority: 'low' | 'medium' | 'high';
  currentPortfolioValue: number;
  projectedPortfolioValue: number;
  targetValue: number;
  gap: number;
  fundedPct: number;
  requiredMonthlyContribution: number;
  actions: string[];
}

export interface CrossAssetIntelligence {
  totalPortfolioValue: number;
  allocation: Array<{ assetClass: AssetClass; marketValue: number; weightPct: number }>;
  weightedExpectedReturnPct?: number;
  diversificationScore: number;
  goals: GoalFundingGap[];
  warnings: string[];
  actions: string[];
}

function nonNegative(name: string, value: number) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be non-negative`);
}

function futureValue(principal: number, annualReturnPct: number, years: number, monthlyContribution: number) {
  const months = Math.round(years * 12);
  if (months === 0) return principal;
  const monthlyRate = Math.pow(1 + annualReturnPct / 100, 1 / 12) - 1;
  if (Math.abs(monthlyRate) < 1e-12) return principal + monthlyContribution * months;
  return principal * Math.pow(1 + monthlyRate, months)
    + monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
}

function requiredMonthly(target: number, principal: number, annualReturnPct: number, years: number) {
  if (years === 0) return Math.max(0, target - principal);
  const months = Math.round(years * 12);
  const monthlyRate = Math.pow(1 + annualReturnPct / 100, 1 / 12) - 1;
  if (Math.abs(monthlyRate) < 1e-12) return Math.max(0, (target - principal) / months);
  const growth = Math.pow(1 + monthlyRate, months);
  return Math.max(0, (target - principal * growth) * monthlyRate / (growth - 1));
}

/**
 * Cross-asset decision intelligence. It combines verified holdings with user goals
 * and produces transparent funding gaps; it does not generate market prices.
 */
export function buildCrossAssetIntelligence(input: CrossAssetIntelligenceInput): CrossAssetIntelligence {
  const monthlyContribution = input.monthlyContribution ?? 0;
  const defaultReturn = input.assumedAnnualReturnPct ?? 10;
  nonNegative('Monthly contribution', monthlyContribution);
  if (!Number.isFinite(defaultReturn) || defaultReturn <= -100) throw new Error('Assumed return must be greater than -100%');

  const holdings = input.holdings.filter((h) => Number.isFinite(h.marketValue) && h.marketValue > 0);
  const total = holdings.reduce((sum, h) => sum + h.marketValue, 0);
  const byClass = new Map<AssetClass, number>();
  let weightedReturn = 0;
  let weightedCount = 0;
  for (const h of holdings) {
    byClass.set(h.assetClass, (byClass.get(h.assetClass) ?? 0) + h.marketValue);
    if (h.expectedAnnualReturnPct != null && Number.isFinite(h.expectedAnnualReturnPct)) {
      weightedReturn += h.marketValue * h.expectedAnnualReturnPct;
      weightedCount += h.marketValue;
    }
  }
  const allocation = (['stock', 'mutual_fund', 'cash'] as AssetClass[])
    .filter((assetClass) => byClass.has(assetClass))
    .map((assetClass) => ({ assetClass, marketValue: byClass.get(assetClass)!, weightPct: total > 0 ? byClass.get(assetClass)! / total * 100 : 0 }));

  const nonCashClasses = allocation.filter((a) => a.assetClass !== 'cash' && a.weightPct >= 5).length;
  const concentration = allocation.length ? Math.max(...allocation.map((a) => a.weightPct)) : 100;
  const diversificationScore = Math.round(Math.max(0, Math.min(100, nonCashClasses * 30 + (concentration <= 70 ? 25 : concentration <= 85 ? 10 : 0))));
  const warnings: string[] = [];
  const actions: string[] = [];
  if (concentration > 70 && total > 0) warnings.push('One asset class represents more than 70% of the portfolio.');
  if ((byClass.get('cash') ?? 0) / Math.max(1, total) > 40 / 100) warnings.push('Cash exceeds 40% of the portfolio and may reduce long-term growth potential.');
  if (nonCashClasses < 2 && total > 0) warnings.push('The portfolio has limited cross-asset diversification.');
  if (diversificationScore < 50) actions.push('Review whether adding a complementary asset class would improve diversification.');
  if ((byClass.get('cash') ?? 0) < total * 0.05 && total > 0) actions.push('Maintain an adequate liquidity reserve before taking additional risk.');

  const goals = [...input.goals].filter((g) => Number.isFinite(g.targetValue) && g.targetValue >= 0 && Number.isFinite(g.years) && g.years >= 0).map((goal) => {
    const priority = goal.priority ?? 'medium';
    const projected = futureValue(total, weightedCount > 0 ? weightedReturn / weightedCount : defaultReturn, goal.years, monthlyContribution);
    const gap = Math.max(0, goal.targetValue - projected);
    const fundedPct = goal.targetValue > 0 ? Math.min(100, projected / goal.targetValue * 100) : 100;
    const required = requiredMonthly(goal.targetValue, total, weightedCount > 0 ? weightedReturn / weightedCount : defaultReturn, goal.years);
    const goalActions: string[] = [];
    if (gap > 0) goalActions.push(`Increase monthly contribution toward ₹${Math.round(required).toLocaleString('en-IN')} to close the projected gap.`);
    else goalActions.push('Current portfolio and contribution assumptions cover the target under the stated scenario.');
    return { name: goal.name, priority, currentPortfolioValue: total, projectedPortfolioValue: projected, targetValue: goal.targetValue, gap, fundedPct, requiredMonthlyContribution: required, actions: goalActions };
  }).sort((a, b) => (b.priority === 'high' ? 3 : b.priority === 'medium' ? 2 : 1) - (a.priority === 'high' ? 3 : a.priority === 'medium' ? 2 : 1));

  if (goals.some((g) => g.gap > 0 && g.priority === 'high')) actions.push('Prioritize closing high-priority goal funding gaps before increasing discretionary risk.');
  return {
    totalPortfolioValue: total,
    allocation,
    ...(weightedCount > 0 ? { weightedExpectedReturnPct: weightedReturn / weightedCount } : {}),
    diversificationScore,
    goals,
    warnings,
    actions,
  };
}
