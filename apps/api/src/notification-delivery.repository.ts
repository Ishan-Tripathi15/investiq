import { createHash } from 'node:crypto';
import { Pool } from 'pg';
import { decryptField, encryptField } from './security.crypto';

export type NotificationChannel = 'push' | 'email' | 'sms';
export type NotificationDeliveryStatus = 'queued' | 'sent' | 'failed' | 'unavailable';

export interface NotificationDevice {
  id: string;
  userId: string;
  platform: 'ios' | 'android';
  provider: 'expo' | 'apns' | 'fcm';
  pushToken: string;
  enabled: boolean;
}

export interface DeliveryRecord {
  id?: number;
  notificationId?: number;
  userId: string;
  channel: NotificationChannel;
  provider: string;
  destinationHash?: string;
  status: NotificationDeliveryStatus;
  providerMessageId?: string;
  errorCode?: string;
  errorMessage?: string;
  attemptCount: number;
  nextAttemptAt?: string;
  lastAttemptAt?: string;
  maxAttempts?: number;
}

export class NotificationDeliveryRepository {
  private readonly pool: Pool | null;
  constructor() {
    const url = process.env.DATABASE_URL;
    this.pool = url ? new Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30_000 }) : null;
  }

  async registerDevice(input: Omit<NotificationDevice, 'enabled'>): Promise<void> {
    if (!this.pool) throw new Error('DATABASE_URL is required for notification devices');
    const tokenHash = createHash('sha256').update(input.pushToken).digest('hex');
    const encryptedToken = encryptField(input.pushToken);
    await this.pool.query(
      `INSERT INTO notification_devices(id,user_id,platform,provider,push_token,token_hash,enabled)
       VALUES($1,$2,$3,$4,$5,$6,TRUE)
       ON CONFLICT(token_hash) DO UPDATE SET user_id=EXCLUDED.user_id,platform=EXCLUDED.platform,provider=EXCLUDED.provider,push_token=EXCLUDED.push_token,enabled=TRUE,updated_at=NOW()`,
      [input.id, input.userId, input.platform, input.provider, encryptedToken, tokenHash],
    );
  }

  async listDevices(userId: string): Promise<NotificationDevice[]> {
    if (!this.pool) return [];
    const result = await this.pool.query(
      `SELECT id,user_id,platform,provider,push_token,enabled FROM notification_devices WHERE user_id=$1 AND enabled=TRUE ORDER BY updated_at DESC`,
      [userId],
    );
    return result.rows.flatMap((row) => {
      try {
        return [{ id: String(row.id), userId: String(row.user_id), platform: row.platform, provider: row.provider, pushToken: decryptField(String(row.push_token)), enabled: Boolean(row.enabled) }];
      } catch {
        return [];
      }
    });
  }

  async disableDevice(userId: string, deviceId: string): Promise<boolean> {
    if (!this.pool) return false;
    const result = await this.pool.query(`UPDATE notification_devices SET enabled=FALSE,updated_at=NOW() WHERE id=$1 AND user_id=$2`, [deviceId, userId]);
    return result.rowCount === 1;
  }

  async recordDelivery(input: DeliveryRecord): Promise<number | undefined> {
    if (!this.pool) return undefined;
    const result = await this.pool.query(
      `INSERT INTO notification_deliveries(notification_id,user_id,channel,provider,destination_hash,status,provider_message_id,error_code,error_message,attempt_count,sent_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CASE WHEN $6='sent' THEN NOW() ELSE NULL END, NOW(), CASE WHEN $6='failed' AND $10 < 3 THEN NOW() + INTERVAL '1 minute' * POWER(2, $10 - 1) ELSE NULL END, 3) RETURNING id`,
      [input.notificationId ?? null,input.userId,input.channel,input.provider,input.destinationHash ?? null,input.status,input.providerMessageId ?? null,input.errorCode ?? null,input.errorMessage ?? null,input.attemptCount],
    );
    return Number(result.rows[0]?.id);
  }

  async recordAuditEvent(input: { userId: string; notificationId?: number; eventType: string; status?: string; provider?: string; attemptCount?: number; errorCode?: string; metadata?: Record<string, unknown> }) {
    if (!this.pool) return undefined;
    const result = await this.pool.query(
      `INSERT INTO notification_audit_events(user_id,notification_id,event_type,status,provider,attempt_count,error_code,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING id`,
      [input.userId,input.notificationId ?? null,input.eventType,input.status ?? null,input.provider ?? null,input.attemptCount ?? null,input.errorCode ?? null,JSON.stringify(input.metadata ?? {})],
    );
    return Number(result.rows[0]?.id);
  }

  async listDeliveries(userId: string, limit = 100): Promise<DeliveryRecord[]> {
    if (!this.pool) return [];
    const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)));
    const result = await this.pool.query(
      `SELECT id,notification_id,user_id,channel,provider,destination_hash,status,provider_message_id,error_code,error_message,attempt_count,next_attempt_at,last_attempt_at,max_attempts
       FROM notification_deliveries WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2`, [userId, safeLimit]);
    return result.rows.map((row) => ({
      id: Number(row.id), notificationId: row.notification_id ? Number(row.notification_id) : undefined, userId: String(row.user_id),
      channel: row.channel, provider: String(row.provider), destinationHash: row.destination_hash ?? undefined,
      status: row.status, providerMessageId: row.provider_message_id ?? undefined, errorCode: row.error_code ?? undefined,
      errorMessage: row.error_message ?? undefined, attemptCount: Number(row.attempt_count), nextAttemptAt: row.next_attempt_at ?? undefined, lastAttemptAt: row.last_attempt_at ?? undefined, maxAttempts: Number(row.max_attempts),
    }));
  }
}
