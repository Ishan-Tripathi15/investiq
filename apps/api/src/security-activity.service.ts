import { Injectable } from '@nestjs/common';
import { SecurityActivityRepository, type SecurityActivityRecord } from './security-activity.repository';
import { SecurityNotificationsService } from './security-notifications.service';

const NOTIFIABLE_EVENTS: Record<string, { severity: 'info' | 'warning' | 'critical'; title: string }> = {
  'auth.login_success': { severity: 'info', title: 'Successful sign-in' },
  'auth.login_failed': { severity: 'warning', title: 'Failed sign-in attempt' },
  'auth.mfa_failed': { severity: 'warning', title: 'MFA verification failed' },
  'auth.new_device': { severity: 'warning', title: 'New device sign-in' },
  'auth.risk_blocked': { severity: 'critical', title: 'Suspicious sign-in blocked' },
  'auth.mfa_changed': { severity: 'critical', title: 'MFA security setting changed' },
  'auth.password_changed': { severity: 'critical', title: 'Password changed' },
  'broker.connection_added': { severity: 'critical', title: 'Broker account connected' },
  'security.session_revoked': { severity: 'warning', title: 'Session revoked' },
};

@Injectable()
export class SecurityActivityService {
  constructor(
    private readonly repository: SecurityActivityRepository,
    private readonly notifications: SecurityNotificationsService,
  ) {}

  async record(userId: string, eventType: string, metadata: Record<string, unknown> = {}, requestId?: string): Promise<void> {
    await this.repository.record({ userId, eventType, metadata, requestId });
    const notification = NOTIFIABLE_EVENTS[eventType];
    if (!notification) return;
    void this.notifications.create({
      userId,
      severity: notification.severity,
      eventType,
      title: notification.title,
      message: this.messageFor(eventType),
      metadata: this.safeMetadata(metadata),
    });
  }

  list(userId: string, limit = 50): Promise<SecurityActivityRecord[]> {
    return this.repository.list(userId, limit);
  }

  private messageFor(eventType: string): string {
    switch (eventType) {
      case 'auth.login_failed': return 'A sign-in attempt was not completed successfully. If you do not recognize it, review your sessions and security settings.';
      case 'auth.mfa_failed': return 'A sign-in attempt reached MFA but the verification failed. Review your account if this was not you.';
      case 'auth.new_device': return 'Your account was accessed from a device that has not previously been trusted.';
      case 'auth.risk_blocked': return 'A suspicious sign-in was blocked by InvestIQ security controls.';
      case 'auth.mfa_changed': return 'Your multi-factor authentication setting was changed.';
      case 'auth.password_changed': return 'Your account password was changed.';
      case 'broker.connection_added': return 'A broker account was connected to InvestIQ. Verify this connection if you did not authorize it.';
      case 'security.session_revoked': return 'An active account session was revoked.';
      default: return 'A security-related activity occurred on your InvestIQ account.';
    }
  }

  private safeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
    const blocked = new Set(['password', 'passwordHash', 'otp', 'mfaCode', 'refreshToken', 'accessToken', 'authorization', 'secret']);
    return Object.fromEntries(Object.entries(metadata).filter(([key]) => !blocked.has(key)));
  }
}
