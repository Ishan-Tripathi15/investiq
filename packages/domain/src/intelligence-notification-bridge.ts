export type IntelligenceNotificationSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface IntelligenceAction {
  id: string;
  severity: IntelligenceNotificationSeverity;
  title: string;
  reason: string;
  action: string;
  source: 'portfolio' | 'allocation' | 'goal';
  amount?: number;
}

export interface IntelligenceNotification {
  eventType: 'portfolio.action';
  severity: 'warning' | 'critical' | 'info';
  title: string;
  message: string;
  metadata: {
    actionId: string;
    source: IntelligenceAction['source'];
    amount?: number;
  };
}

export function buildIntelligenceNotifications(actions: IntelligenceAction[], limit = 3): IntelligenceNotification[] {
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new Error('limit must be between 1 and 10');

  const severity: Record<IntelligenceNotificationSeverity, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  return [...actions]
    .sort((a, b) => severity[b.severity] - severity[a.severity] || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map((action) => ({
      eventType: 'portfolio.action',
      severity: action.severity === 'critical' ? 'critical' : action.severity === 'high' ? 'warning' : 'info',
      title: action.title,
      message: action.action,
      metadata: { actionId: action.id, source: action.source, ...(action.amount !== undefined ? { amount: action.amount } : {}) },
    }));
}
