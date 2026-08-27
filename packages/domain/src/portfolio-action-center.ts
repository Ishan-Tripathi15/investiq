export type ActionSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface PortfolioAction {
  id: string;
  severity: ActionSeverity;
  title: string;
  reason: string;
  action: string;
  source: 'portfolio' | 'allocation' | 'goal';
  amount?: number;
}

const rank: Record<ActionSeverity, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export function buildPortfolioActionCenter(input: {
  portfolio: { riskLevel: 'low' | 'moderate' | 'high' | 'critical'; warnings: string[]; actions: string[] };
  rebalance?: { needsRebalance: boolean; actions: Array<{ assetClass: string; action: 'buy' | 'sell' | 'hold'; amount: number; driftPct: number }>; };
  goals?: Array<{ name: string; priority: 'low' | 'medium' | 'high'; gap: number; requiredMonthlyContribution: number }>;
}): { actions: PortfolioAction[]; summary: { critical: number; high: number; medium: number; low: number } } {
  const actions: PortfolioAction[] = [];
  input.portfolio.warnings.forEach((warning, index) => {
    const severity: ActionSeverity = input.portfolio.riskLevel === 'critical' ? 'critical' : input.portfolio.riskLevel === 'high' ? 'high' : 'medium';
    actions.push({ id: `portfolio-warning-${index + 1}`, severity, title: 'Portfolio risk warning', reason: warning, action: input.portfolio.actions[index] ?? 'Review the portfolio risk signal.', source: 'portfolio' });
  });
  input.rebalance?.actions.filter((a) => a.action !== 'hold').forEach((a, index) => {
    actions.push({
      id: `rebalance-${a.assetClass}-${index + 1}`,
      severity: Math.abs(a.driftPct) > 15 ? 'high' : 'medium',
      title: `Rebalance ${a.assetClass}`,
      reason: `${a.assetClass} allocation is ${Math.abs(a.driftPct).toFixed(1)} percentage points from target.`,
      action: `${a.action === 'buy' ? 'Increase' : 'Reduce'} ${a.assetClass} allocation by approximately ₹${Math.round(a.amount).toLocaleString('en-IN')}.`,
      source: 'allocation',
      amount: a.amount,
    });
  });
  input.goals?.filter((g) => g.gap > 0).forEach((g) => {
    const severity: ActionSeverity = g.priority === 'high' ? 'high' : g.priority === 'medium' ? 'medium' : 'low';
    actions.push({
      id: `goal-${g.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
      severity,
      title: `Funding gap: ${g.name}`,
      reason: `Projected funding is short by approximately ₹${Math.round(g.gap).toLocaleString('en-IN')}.`,
      action: `Consider a monthly contribution of approximately ₹${Math.round(g.requiredMonthlyContribution).toLocaleString('en-IN')}.`,
      source: 'goal',
      amount: g.gap,
    });
  });
  if (actions.length === 0) actions.push({ id: 'all-clear', severity: 'low', title: 'Portfolio looks healthy', reason: 'No material action was generated from the supplied intelligence.', action: 'Continue monitoring allocation, risk, liquidity and goal progress.', source: 'portfolio' });
  actions.sort((a, b) => rank[b.severity] - rank[a.severity] || a.title.localeCompare(b.title));
  const summary = { critical: 0, high: 0, medium: 0, low: 0 };
  actions.forEach((a) => summary[a.severity]++);
  return { actions, summary };
}
