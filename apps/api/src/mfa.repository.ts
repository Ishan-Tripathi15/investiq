import { Pool } from 'pg';

export interface MfaRecord { userId: string; secretCiphertext: string; enabledAt?: string; }
export interface MfaChallenge { id: string; userId: string; }

export class MfaRepository {
  private readonly pool: Pool | null;
  constructor() {
    const url = process.env.DATABASE_URL;
    this.pool = url ? new Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30_000 }) : null;
  }
  private async schema() {
    if (!this.pool) return;
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS user_mfa (user_id TEXT PRIMARY KEY, secret_ciphertext TEXT NOT NULL, enabled_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS auth_mfa_challenges (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, challenge_hash TEXT NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL, consumed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE INDEX IF NOT EXISTS idx_auth_mfa_challenges_active ON auth_mfa_challenges(challenge_hash, expires_at) WHERE consumed_at IS NULL;
    `);
  }
  async get(userId: string): Promise<MfaRecord | null> {
    if (!this.pool) return null; await this.schema();
    const r = await this.pool.query(`SELECT user_id, secret_ciphertext, enabled_at FROM user_mfa WHERE user_id=$1`, [userId]);
    const x = r.rows[0]; return x ? { userId:x.user_id, secretCiphertext:x.secret_ciphertext, enabledAt:x.enabled_at ? new Date(x.enabled_at).toISOString() : undefined } : null;
  }
  async saveSecret(userId: string, secretCiphertext: string): Promise<void> {
    if (!this.pool) throw new Error('DATABASE_URL is required for MFA'); await this.schema();
    await this.pool.query(`INSERT INTO user_mfa(user_id,secret_ciphertext) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET secret_ciphertext=EXCLUDED.secret_ciphertext, updated_at=NOW()`, [userId, secretCiphertext]);
  }
  async enable(userId: string): Promise<void> { if (!this.pool) throw new Error('DATABASE_URL is required for MFA'); await this.schema(); await this.pool.query(`UPDATE user_mfa SET enabled_at=NOW(), updated_at=NOW() WHERE user_id=$1`, [userId]); }
  async disable(userId: string): Promise<void> { if (!this.pool) throw new Error('DATABASE_URL is required for MFA'); await this.schema(); await this.pool.query(`UPDATE user_mfa SET enabled_at=NULL, updated_at=NOW() WHERE user_id=$1`, [userId]); }
  async createChallenge(id: string, userId: string, hash: string, expiresAt: string): Promise<void> {
    if (!this.pool) throw new Error('DATABASE_URL is required for MFA'); await this.schema();
    await this.pool.query(`INSERT INTO auth_mfa_challenges(id,user_id,challenge_hash,expires_at) VALUES($1,$2,$3,$4)`, [id,userId,hash,expiresAt]);
  }
  async consumeChallenge(hash: string): Promise<MfaChallenge | null> {
    if (!this.pool) return null; await this.schema();
    const r = await this.pool.query(`UPDATE auth_mfa_challenges SET consumed_at=NOW() WHERE challenge_hash=$1 AND consumed_at IS NULL AND expires_at>NOW() RETURNING id,user_id`, [hash]);
    const x = r.rows[0]; return x ? { id:x.id, userId:x.user_id } : null;
  }
  async close(): Promise<void> { await this.pool?.end(); }
}
