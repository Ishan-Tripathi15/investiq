import type { PortfolioAction } from './portfolio-action-center';
import type { ProactiveAlert } from './proactive-intelligence-alerts';
import type { IntelligenceNotification, IntelligenceAction } from './intelligence-notification-bridge';

export interface UnifiedIntelligenceSnapshot {
  generatedAt: string;
  actions: PortfolioAction[];
  alerts: ProactiveAlert[];
  notifications: IntelligenceNotification[];
  counts: {
    actions: Record<PortfolioAction['severity'], number>;
    alerts: Record<ProactiveAlert['severity'], number>;
    notifications: number;
  };
}

export function buildUnifiedIntelligenceSnapshot(input: {
  actions: PortfolioAction[];
  alerts: ProactiveAlert[];
  notifications: IntelligenceNotification[];
  generatedAt?: string;
}): UnifiedIntelligenceSnapshot {
  const counts = {
    actions: { critical: 0, high: 0, medium: 0, low: 0 },
    alerts: { critical: 0, high: 0, medium: 0, low: 0 },
    notifications: input.notifications.length,
  };
  input.actions.forEach((item) => counts.actions[item.severity]++);
  input.alerts.forEach((item) => counts.alerts[item.severity]++);
  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    actions: input.actions,
    alerts: input.alerts,
    notifications: input.notifications,
    counts,
  };
}
