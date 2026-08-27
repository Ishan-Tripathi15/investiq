import { Injectable } from '@nestjs/common';
import { toLiveIntelligenceNotification, type LiveIntelligenceAction } from '@investiq/domain';
import { Observable, from, interval, of } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';
import { SecurityNotificationsRepository, type SecurityNotification, type SecurityNotificationSeverity } from './security-notifications.repository';
import { NotificationDeliveryService } from './notification-delivery.service';

export interface SecurityNotificationInput {
  userId: string;
  severity: SecurityNotificationSeverity;
  eventType: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface SecurityNotificationSseMessage {
  type: 'security.connected' | 'security.notification';
  id?: string;
  data: SecurityNotification | { status: 'connected'; afterId: number };
}

@Injectable()
export class SecurityNotificationsService {
  constructor(private readonly repository: SecurityNotificationsRepository, private readonly delivery: NotificationDeliveryService) {}

  async create(input: SecurityNotificationInput) {
    const notification = await this.repository.create({ ...input, metadata: input.metadata ?? {}, idempotencyKey: input.idempotencyKey });
    if (notification) {
      try {
        await this.delivery.retryableDeliver(notification);
      } catch {
        // The security event remains persisted even when an external provider is unavailable.
      }
    }
    return notification;
  }

  async getPreferences(userId: string) { return this.repository.getPreference(userId); }

  async setPreferences(userId: string, preferences: Record<string, unknown>) { return this.repository.upsertPreference(userId, preferences); }

  async createIntelligenceAction(userId: string, action: LiveIntelligenceAction) {
    const event = toLiveIntelligenceNotification(userId, action);
    return this.create(event);
  }

  list(userId: string, afterId = 0, limit = 50) {
    return this.repository.list(userId, afterId, limit);
  }

  unreadCount(userId: string) {
    return this.repository.unreadCount(userId);
  }

  async markRead(userId: string, notificationId: number) {
    if (!Number.isInteger(notificationId) || notificationId <= 0) return false;
    return this.repository.markRead(userId, notificationId);
  }

  stream(userId: string, afterId = 0): Observable<SecurityNotificationSseMessage> {
    let cursor = Number.isFinite(afterId) && afterId > 0 ? Math.floor(afterId) : 0;
    const initial: SecurityNotificationSseMessage = { type: 'security.connected', data: { status: 'connected', afterId: cursor } };
    return interval(1000).pipe(
      startWith(0),
      switchMap(() => from(this.repository.list(userId, cursor, 100)).pipe(catchError(() => of([] as SecurityNotification[])))),
      map((notifications) => {
        if (!notifications.length) return initial;
        const notification = notifications[notifications.length - 1];
        cursor = notification.id;
        return { type: 'security.notification', data: notification, id: String(notification.id) } satisfies SecurityNotificationSseMessage;
      }),
    );
  }
}
