import { Pool } from 'pg';

export interface SecurityActivityRecord {
  id: number;
  userId: string;
  eventType: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export class SecurityActivityRepository {
  private readonly pool: Pool | null;

  constructor() {
    const url = process.env.DATABASE_URL;
    this.pool = url ? new Pool({ connectionString: url, max: 5, idleTimeoutMillis: 30_000 }) : null;
  }

  private async ensureSchema(): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS security_activity (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        request_id TEXT,
        ip_address INET,
        user_agent TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_security_activity_user_time ON security_activity(user_id, created_at DESC);
    `);
  }

  async record(input: Omit<SecurityActivityRecord, 'id' | 'createdAt'>): Promise<void> {
    if (!this.pool) return;
    await this.ensureSchema();
    await this.pool.query(
      `INSERT INTO security_activity(user_id,event_type,request_id,ip_address,user_agent,metadata)
       VALUES($1,$2,$3,$4,$5,$6::jsonb)`,
      [input.userId, input.eventType, input.requestId ?? null, input.ipAddress ?? null, input.userAgent ?? null, JSON.stringify(input.metadata ?? {})],
    );
  }

  async list(userId: string, limit = 50): Promise<SecurityActivityRecord[]> {
    if (!this.pool) return [];
    await this.ensureSchema();
    const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)));
    const result = await this.pool.query(
      `SELECT id,user_id,event_type,request_id,host(ip_address) AS ip_address,user_agent,metadata,created_at
       FROM security_activity WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2`,
      [userId, safeLimit],
    );
    return result.rows.map((row) => ({
      id: Number(row.id),
      userId: row.user_id,
      eventType: row.event_type,
      requestId: row.request_id ?? undefined,
      ipAddress: row.ip_address ?? undefined,
      userAgent: row.user_agent ?? undefined,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }

  async close(): Promise<void> { await this.pool?.end(); }
}
