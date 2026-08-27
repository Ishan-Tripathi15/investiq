import type { PortfolioAction } from './portfolio-action-center';

export interface IntelligenceAlertTrigger {
  actionId: string;
  shouldNotify: boolean;
  reason: string;
}

export function evaluateIntelligenceAlertTriggers(
  actions: PortfolioAction[],
  options: { minimumSeverity?: PortfolioAction['severity']; maxNotifications?: number } = {},
): IntelligenceAlertTrigger[] {
  const rank = { low: 1, medium: 2, high: 3, critical: 4 } as const;
  const minimum = options.minimumSeverity ?? 'high';
  const max = options.maxNotifications ?? 3;
  if (!Number.isInteger(max) || max < 1 || max > 10) throw new Error('maxNotifications must be between 1 and 10');

  let count = 0;
  return [...actions]
    .sort((a, b) => rank[b.severity] - rank[a.severity] || a.id.localeCompare(b.id))
    .map((action) => {
      if (rank[action.severity] < rank[minimum]) return { actionId: action.id, shouldNotify: false, reason: 'Below notification severity threshold.' };
      if (count >= max) return { actionId: action.id, shouldNotify: false, reason: 'Notification fan-out limit reached.' };
      count++;
      return { actionId: action.id, shouldNotify: true, reason: action.severity === 'critical' ? 'Critical action requires immediate attention.' : 'Action meets notification threshold.' };
    });
}
