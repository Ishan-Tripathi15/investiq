import { Injectable } from '@nestjs/common';
import { deliverSecurityNotification, type DeliveryRequest } from './notification-providers';
import { NotificationDeliveryRepository, type NotificationChannel } from './notification-delivery.repository';
import { ProfileService } from './profile.service';
import type { SecurityNotification } from './security-notifications.repository';

@Injectable()
export class NotificationDeliveryService {
  constructor(private readonly repository: NotificationDeliveryRepository, private readonly profiles: ProfileService) {}

  async registerDevice(userId: string, input: { id: string; platform: 'ios' | 'android'; provider: 'expo' | 'apns' | 'fcm'; pushToken: string }) {
    if (!input.id || !input.pushToken || input.pushToken.length > 4096) throw new Error('Invalid notification device');
    await this.repository.registerDevice({ ...input, userId });
    return { registered: true };
  }

  async disableDevice(userId: string, deviceId: string) {
    return { disabled: await this.repository.disableDevice(userId, deviceId) };
  }

  async listDeliveries(userId: string, limit = 100) {
    return this.repository.listDeliveries(userId, limit);
  }

  async retryableDeliver(notification: SecurityNotification, attemptCount = 1): Promise<void> {
    try { await this.deliver(notification, attemptCount); } catch (error) { if (attemptCount >= 3) throw error; await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * 2 ** (attemptCount - 1), 4000))); await this.retryableDeliver(notification, attemptCount + 1); }
  }

  async deliver(notification: SecurityNotification, attemptCount = 1): Promise<void> {
    const profile = await this.profiles.get(notification.userId);
    const devices = await this.repository.listDevices(notification.userId);
    const request: DeliveryRequest = {
      channel: 'push',
      title: notification.title,
      message: notification.message,
      email: typeof profile.email === 'string' ? profile.email : undefined,
      phone: typeof profile.phone === 'string' ? profile.phone : undefined,
      devices,
      data: { notificationId: String(notification.id), eventType: notification.eventType, severity: notification.severity },
    };
    const startedAt = Date.now();
    const results = await deliverSecurityNotification(request);
    for (const result of results) {
      await this.repository.recordAuditEvent({ userId: notification.userId, notificationId: notification.id, eventType: 'delivery_attempt', status: result.status, provider: result.provider, attemptCount, errorCode: result.errorCode, metadata: { latencyMs: Date.now() - startedAt, channel: result.channel } });
      await this.repository.recordDelivery({
        notificationId: notification.id,
        userId: notification.userId,
        channel: result.channel as NotificationChannel,
        provider: result.provider,
        destinationHash: result.destinationHash,
        status: result.status,
        providerMessageId: result.providerMessageId,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        attemptCount,
      });
    }
  }
}
