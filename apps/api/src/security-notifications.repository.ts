import { Pool } from 'pg';

export type SecurityNotificationSeverity = 'info' | 'warning' | 'critical';

export interface SecurityNotification {
  id: number;
  userId: string;
  severity: SecurityNotificationSeverity;
  eventType: string;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  readAt?: string;
  createdAt: string;
  idempotencyKey?: string;
}

export class SecurityNotificationsRepository {
  private readonly pool: Pool | null;

  constructor() {
    const url = process.env.DATABASE_URL;
    this.pool = url ? new Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30_000 }) : null;
  }

  async upsertPreference(userId: string, preferences: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!this.pool) return preferences;
    await this.pool.query(
      `INSERT INTO notification_preferences(user_id, preferences) VALUES($1,$2::jsonb)
       ON CONFLICT(user_id) DO UPDATE SET preferences=EXCLUDED.preferences, updated_at=NOW()`,
      [userId, JSON.stringify(preferences)],
    );
    return preferences;
  }

  async getPreference(userId: string): Promise<Record<string, unknown>> {
    if (!this.pool) return {};
    const result = await this.pool.query(`SELECT preferences FROM notification_preferences WHERE user_id=$1`, [userId]);
    return (result.rows[0]?.preferences ?? {}) as Record<string, unknown>;
  }

  async create(input: Omit<SecurityNotification, 'id' | 'createdAt' | 'readAt'>): Promise<SecurityNotification | null> {
    if (!this.pool) return null;
    const result = await this.pool.query(
      `INSERT INTO security_notifications(user_id, severity, event_type, title, message, metadata, idempotency_key)
       VALUES($1, $2, $3, $4, $5, $6::jsonb, $7)
       ON CONFLICT (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
       RETURNING id, user_id, severity, event_type, title, message, metadata, read_at, created_at`,
      [input.userId, input.severity, input.eventType, input.title, input.message, JSON.stringify(input.metadata), input.idempotencyKey ?? null],
    );
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async list(userId: string, afterId = 0, limit = 50): Promise<SecurityNotification[]> {
    if (!this.pool) return [];
    const safeAfterId = Number.isFinite(afterId) && afterId > 0 ? Math.floor(afterId) : 0;
    const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)));
    const result = await this.pool.query(
      `SELECT id, user_id, severity, event_type, title, message, metadata, read_at, created_at
       FROM security_notifications WHERE user_id = $1 AND id > $2 ORDER BY id ASC LIMIT $3`,
      [userId, safeAfterId, safeLimit],
    );
    return result.rows.map((row) => this.map(row));
  }

  async unreadCount(userId: string): Promise<number> {
    if (!this.pool) return 0;
    const result = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM security_notifications WHERE user_id = $1 AND read_at IS NULL`,
      [userId],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async markRead(userId: string, notificationId: number): Promise<boolean> {
    if (!this.pool) return false;
    const result = await this.pool.query(
      `UPDATE security_notifications SET read_at = COALESCE(read_at, NOW()) WHERE id = $1 AND user_id = $2`,
      [notificationId, userId],
    );
    return result.rowCount === 1;
  }

  private map(row: Record<string, unknown>): SecurityNotification {
    return {
      id: Number(row.id),
      userId: String(row.user_id),
      severity: row.severity as SecurityNotificationSeverity,
      eventType: String(row.event_type),
      title: String(row.title),
      message: String(row.message),
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      readAt: row.read_at ? new Date(String(row.read_at)).toISOString() : undefined,
      createdAt: new Date(String(row.created_at)).toISOString(),
    };
  }
}
