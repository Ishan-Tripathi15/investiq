import { Pool } from 'pg';

export interface AuthSession {
  id: string;
  userId: string;
  expiresAt: string;
  createdAt?: string;
  lastUsedAt?: string;
  revoked: boolean;
  deviceLabel?: string;
  deviceIdHash?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class AuthRepository {
  private readonly pool: Pool | null;
  constructor() { const url = process.env.DATABASE_URL; this.pool = url ? new Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30_000 }) : null; }
  private async schema() {
    if (!this.pool) return;
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS auth_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        device_id_hash TEXT,
        device_label TEXT,
        ip_address INET,
        user_agent TEXT
      );
      ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
      ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS device_id_hash TEXT;
      ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS device_label TEXT;
      ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS ip_address INET;
      ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;
      CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_active_created ON auth_sessions(user_id, revoked_at, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_auth_sessions_device ON auth_sessions(user_id, device_id_hash) WHERE revoked_at IS NULL;
    `);
  }
  async create(session: AuthSession, tokenHash: string): Promise<void> {
    if (!this.pool) throw new Error('DATABASE_URL is required for authenticated sessions');
    await this.schema();
    await this.pool.query(
      `INSERT INTO auth_sessions(id,user_id,token_hash,expires_at,device_id_hash,device_label,ip_address,user_agent)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [session.id, session.userId, tokenHash, session.expiresAt, session.deviceIdHash ?? null, session.deviceLabel ?? null, session.ipAddress ?? null, session.userAgent ?? null],
    );
  }
  async findActive(id: string, tokenHash: string): Promise<AuthSession | null> {
    if (!this.pool) return null; await this.schema();
    const r = await this.pool.query(`SELECT id,user_id,expires_at,revoked_at,created_at,last_used_at,device_id_hash,device_label,ip_address,user_agent FROM auth_sessions WHERE id=$1 AND token_hash=$2 AND revoked_at IS NULL AND expires_at>NOW()`, [id, tokenHash]);
    const x = r.rows[0];
    return x ? { id:x.id, userId:x.user_id, expiresAt:new Date(x.expires_at).toISOString(), createdAt:new Date(x.created_at).toISOString(), lastUsedAt:new Date(x.last_used_at).toISOString(), revoked:false, deviceIdHash:x.device_id_hash ?? undefined, deviceLabel:x.device_label ?? undefined, ipAddress:x.ip_address ?? undefined, userAgent:x.user_agent ?? undefined } : null;
  }
  async rotate(id: string, oldHash: string, newHash: string, expiresAt: string): Promise<boolean> { if (!this.pool) return false; await this.schema(); const r = await this.pool.query(`UPDATE auth_sessions SET token_hash=$3, expires_at=$4, last_used_at=NOW() WHERE id=$1 AND token_hash=$2 AND revoked_at IS NULL AND expires_at>NOW()`, [id, oldHash, newHash, expiresAt]); return r.rowCount === 1; }
  async revoke(id: string, tokenHash: string): Promise<boolean> { if (!this.pool) return false; await this.schema(); const r = await this.pool.query(`UPDATE auth_sessions SET revoked_at=NOW(), last_used_at=NOW() WHERE id=$1 AND token_hash=$2 AND revoked_at IS NULL`, [id, tokenHash]); return r.rowCount === 1; }
  async listActive(userId: string): Promise<AuthSession[]> {
    if (!this.pool) return [];
    await this.schema();
    const r = await this.pool.query(`SELECT id,user_id,expires_at,created_at,last_used_at,revoked_at,device_id_hash,device_label,ip_address,user_agent FROM auth_sessions WHERE user_id=$1 AND revoked_at IS NULL AND expires_at>NOW() ORDER BY last_used_at DESC`, [userId]);
    return r.rows.map((x) => ({ id:x.id, userId:x.user_id, expiresAt:new Date(x.expires_at).toISOString(), createdAt:new Date(x.created_at).toISOString(), lastUsedAt:new Date(x.last_used_at).toISOString(), revoked:false, deviceIdHash:x.device_id_hash ?? undefined, deviceLabel:x.device_label ?? undefined, ipAddress:x.ip_address ?? undefined, userAgent:x.user_agent ?? undefined }));
  }
  async revokeSession(userId: string, sessionId: string): Promise<boolean> {
    if (!this.pool) return false;
    await this.schema();
    const r = await this.pool.query(`UPDATE auth_sessions SET revoked_at=NOW(), last_used_at=NOW() WHERE user_id=$1 AND id=$2 AND revoked_at IS NULL`, [userId, sessionId]);
    return r.rowCount === 1;
  }
  async revokeOthers(userId: string, currentSessionId: string): Promise<number> {
    if (!this.pool) return 0;
    await this.schema();
    const r = await this.pool.query(`UPDATE auth_sessions SET revoked_at=NOW(), last_used_at=NOW() WHERE user_id=$1 AND id<>$2 AND revoked_at IS NULL`, [userId, currentSessionId]);
    return r.rowCount ?? 0;
  }
  async close(): Promise<void> { await this.pool?.end(); }
}
