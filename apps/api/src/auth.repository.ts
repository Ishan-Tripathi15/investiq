import { Pool } from 'pg';

export interface AuthSession { id: string; userId: string; expiresAt: string; revoked: boolean; }

export class AuthRepository {
  private readonly pool: Pool | null;
  constructor() { const url = process.env.DATABASE_URL; this.pool = url ? new Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30_000 }) : null; }
  private async schema() {
    if (!this.pool) return;
    await this.pool.query(`CREATE TABLE IF NOT EXISTS auth_sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()); CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id, created_at DESC);`);
  }
  async create(session: AuthSession, tokenHash: string): Promise<void> { if (!this.pool) throw new Error('DATABASE_URL is required for authenticated sessions'); await this.schema(); await this.pool.query(`INSERT INTO auth_sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,$4)`, [session.id, session.userId, tokenHash, session.expiresAt]); }
  async findActive(id: string, tokenHash: string): Promise<AuthSession | null> { if (!this.pool) return null; await this.schema(); const r = await this.pool.query(`SELECT id,user_id,expires_at,revoked_at FROM auth_sessions WHERE id=$1 AND token_hash=$2 AND revoked_at IS NULL AND expires_at>NOW()`, [id, tokenHash]); const x = r.rows[0]; return x ? { id:x.id, userId:x.user_id, expiresAt:new Date(x.expires_at).toISOString(), revoked:false } : null; }
  async rotate(id: string, oldHash: string, newHash: string, expiresAt: string): Promise<boolean> { if (!this.pool) return false; await this.schema(); const r = await this.pool.query(`UPDATE auth_sessions SET token_hash=$3, expires_at=$4, last_used_at=NOW() WHERE id=$1 AND token_hash=$2 AND revoked_at IS NULL AND expires_at>NOW()`, [id, oldHash, newHash, expiresAt]); return r.rowCount === 1; }
  async revoke(id: string, tokenHash: string): Promise<boolean> { if (!this.pool) return false; await this.schema(); const r = await this.pool.query(`UPDATE auth_sessions SET revoked_at=NOW(), last_used_at=NOW() WHERE id=$1 AND token_hash=$2 AND revoked_at IS NULL`, [id, tokenHash]); return r.rowCount === 1; }
  async close(): Promise<void> { await this.pool?.end(); }
}
