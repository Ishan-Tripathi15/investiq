export type ProactiveAlertSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface ProactiveAlert {
  id: string;
  severity: ProactiveAlertSeverity;
  title: string;
  message: string;
  action: string;
  source: 'portfolio' | 'allocation' | 'goal';
  fingerprint: string;
}

const rank: Record<ProactiveAlertSeverity, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export function buildProactiveIntelligenceAlerts(input: {
  actions: Array<{
    id: string;
    severity: ProactiveAlertSeverity;
    title: string;
    reason: string;
    action: string;
    source: 'portfolio' | 'allocation' | 'goal';
    amount?: number;
  }>;
  maxAlerts?: number;
}): ProactiveAlert[] {
  const maxAlerts = input.maxAlerts ?? 10;
  if (!Number.isInteger(maxAlerts) || maxAlerts < 1 || maxAlerts > 50) throw new Error('maxAlerts must be between 1 and 50');

  const seen = new Set<string>();
  return [...input.actions]
    .sort((a, b) => rank[b.severity] - rank[a.severity] || a.id.localeCompare(b.id))
    .filter((action) => {
      const fingerprint = `${action.source}:${action.title}:${action.reason}`;
      if (seen.has(fingerprint)) return false;
      seen.add(fingerprint);
      return true;
    })
    .slice(0, maxAlerts)
    .map((action) => ({
      id: action.id,
      severity: action.severity,
      title: action.title,
      message: action.reason,
      action: action.action,
      source: action.source,
      fingerprint: `${action.source}:${action.title}:${action.reason}`,
    }));
}
