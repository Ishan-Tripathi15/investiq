export type RebalanceAssetClass = 'stock' | 'mutual_fund' | 'cash';

export interface RebalancePosition {
  assetClass: RebalanceAssetClass;
  marketValue: number;
}

export interface TargetAllocation {
  assetClass: RebalanceAssetClass;
  targetPct: number;
  tolerancePct?: number;
}

export interface RebalanceAction {
  assetClass: RebalanceAssetClass;
  currentPct: number;
  targetPct: number;
  driftPct: number;
  action: 'buy' | 'sell' | 'hold';
  amount: number;
}

export interface RebalanceAdvice {
  portfolioValue: number;
  actions: RebalanceAction[];
  driftScore: number;
  needsRebalance: boolean;
  warnings: string[];
}

export function buildRebalanceAdvice(
  positions: RebalancePosition[],
  targets: TargetAllocation[],
): RebalanceAdvice {
  if (targets.length === 0) throw new Error('At least one target allocation is required');

  const targetTotal = targets.reduce((sum, t) => sum + t.targetPct, 0);
  if (!Number.isFinite(targetTotal) || Math.abs(targetTotal - 100) > 0.01) {
    throw new Error('Target allocations must total 100%');
  }

  for (const target of targets) {
    if (!Number.isFinite(target.targetPct) || target.targetPct < 0 || target.targetPct > 100) {
      throw new Error('Target allocation percentages must be between 0 and 100');
    }
    if (target.tolerancePct != null && (!Number.isFinite(target.tolerancePct) || target.tolerancePct < 0)) {
      throw new Error('Tolerance must be non-negative');
    }
  }

  const values = new Map<RebalanceAssetClass, number>();
  for (const position of positions) {
    if (!Number.isFinite(position.marketValue) || position.marketValue < 0) {
      throw new Error('Position market value must be non-negative');
    }
    values.set(position.assetClass, (values.get(position.assetClass) ?? 0) + position.marketValue);
  }

  const portfolioValue = [...values.values()].reduce((sum, value) => sum + value, 0);
  const actions = targets.map((target) => {
    const currentPct = portfolioValue > 0 ? ((values.get(target.assetClass) ?? 0) / portfolioValue) * 100 : 0;
    const driftPct = currentPct - target.targetPct;
    const tolerance = target.tolerancePct ?? 2;
    const amount = Math.abs(driftPct) / 100 * portfolioValue;
    const action: RebalanceAction['action'] = Math.abs(driftPct) <= tolerance ? 'hold' : driftPct > 0 ? 'sell' : 'buy';
    return { assetClass: target.assetClass, currentPct, targetPct: target.targetPct, driftPct, action, amount };
  });

  const driftScore = portfolioValue > 0
    ? Math.round(Math.max(0, 100 - actions.reduce((sum, a) => sum + Math.abs(a.driftPct), 0)))
    : 100;
  const needsRebalance = actions.some((action) => action.action !== 'hold');
  const warnings: string[] = [];
  if (portfolioValue === 0) warnings.push('Portfolio value is zero; no trade sizing can be recommended.');
  if (needsRebalance) warnings.push('Target allocation drift exceeds one or more configured tolerance bands.');
  return { portfolioValue, actions, driftScore, needsRebalance, warnings };
}
