export type LiveIntelligenceSeverity = 'info' | 'warning' | 'critical';

export interface LiveIntelligenceAction {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  reason: string;
  action: string;
  source: 'portfolio' | 'allocation' | 'goal';
  amount?: number;
}

export interface LiveIntelligenceNotification {
  userId: string;
  severity: LiveIntelligenceSeverity;
  eventType: 'portfolio.action';
  title: string;
  message: string;
  metadata: Record<string, unknown>;
}

export function toLiveIntelligenceNotification(userId: string, action: LiveIntelligenceAction): LiveIntelligenceNotification {
  if (!userId) throw new Error('userId is required');
  return {
    userId,
    severity: action.severity === 'critical' ? 'critical' : action.severity === 'high' ? 'warning' : 'info',
    eventType: 'portfolio.action',
    title: action.title,
    message: action.action,
    metadata: {
      actionId: action.id,
      source: action.source,
      reason: action.reason,
      ...(action.amount !== undefined ? { amount: action.amount } : {}),
    },
  };
}
