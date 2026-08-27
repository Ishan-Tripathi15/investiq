export type NotificationSeverity = 'critical' | 'high' | 'medium' | 'low';
export type NotificationSource = 'portfolio' | 'allocation' | 'goal';

export interface IntelligenceAlert {
  id: string;
  severity: NotificationSeverity;
  title: string;
  reason: string;
  action: string;
  source: NotificationSource;
  createdAt?: string;
}

export interface NotificationPreferences {
  enabled: boolean;
  minimumSeverity?: NotificationSeverity;
  enabledSources?: NotificationSource[];
  deliveryMode?: 'immediate' | 'digest';
  quietHours?: { start: string; end: string };
}

export interface NotificationDecision {
  alertId: string;
  deliver: boolean;
  mode: 'immediate' | 'digest' | 'suppressed';
  reason: string;
}

const rank: Record<NotificationSeverity, number> = { low: 1, medium: 2, high: 3, critical: 4 };

function inQuietHours(time: string, quiet?: { start: string; end: string }) {
  if (!quiet) return false;
  const toMinutes = (v: string) => {
    const m = /^(\d{2}):(\d{2})$/.exec(v);
    if (!m) return -1;
    return Number(m[1]) * 60 + Number(m[2]);
  };
  const now = toMinutes(time), start = toMinutes(quiet.start), end = toMinutes(quiet.end);
  if ([now, start, end].some((v) => v < 0 || v > 1439)) return false;
  return start <= end ? now >= start && now < end : now >= start || now < end;
}

export function decideIntelligenceNotifications(
  alerts: IntelligenceAlert[],
  preferences: NotificationPreferences,
  currentLocalTime?: string,
): NotificationDecision[] {
  const minimum = preferences.minimumSeverity ?? 'low';
  const sources = preferences.enabledSources ?? ['portfolio', 'allocation', 'goal'];
  const mode = preferences.deliveryMode ?? 'immediate';

  return alerts.map((alert) => {
    if (!preferences.enabled) return { alertId: alert.id, deliver: false, mode: 'suppressed', reason: 'Intelligence notifications are disabled.' };
    if (rank[alert.severity] < rank[minimum]) return { alertId: alert.id, deliver: false, mode: 'suppressed', reason: 'Alert severity is below the configured minimum.' };
    if (!sources.includes(alert.source)) return { alertId: alert.id, deliver: false, mode: 'suppressed', reason: 'Alert source is disabled.' };
    if (currentLocalTime && inQuietHours(currentLocalTime, preferences.quietHours) && alert.severity !== 'critical') {
      return { alertId: alert.id, deliver: false, mode: 'suppressed', reason: 'Quiet hours are active for non-critical alerts.' };
    }
    return { alertId: alert.id, deliver: true, mode, reason: alert.severity === 'critical' ? 'Critical alert bypasses quiet hours.' : 'Alert matches notification preferences.' };
  });
}
