import { Pool } from 'pg';

export interface AuthorizationChallenge {
  id: string;
  userId: string;
  payloadHash: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: string;
}

export class TransactionAuthorizationRepository {
  private readonly pool: Pool | null;

  constructor() {
    const url = process.env.DATABASE_URL;
    this.pool = url ? new Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30_000 }) : null;
  }

  private async schema() {
    if (!this.pool) return;
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS transaction_authorization_challenges (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, payload_hash TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0, max_attempts INTEGER NOT NULL DEFAULT 5,
        expires_at TIMESTAMPTZ NOT NULL, consumed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS transaction_authorizations (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE,
        payload_hash TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_transaction_auth_challenges_user ON transaction_authorization_challenges(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_transaction_authorizations_user ON transaction_authorizations(user_id, created_at DESC);
    `);
  }

  async createChallenge(id: string, userId: string, payloadHash: string, expiresAt: string): Promise<void> {
    if (!this.pool) throw new Error('DATABASE_URL is required for transaction authorization');
    await this.schema();
    await this.pool.query(
      `INSERT INTO transaction_authorization_challenges(id,user_id,payload_hash,expires_at) VALUES($1,$2,$3,$4)`,
      [id, userId, payloadHash, expiresAt],
    );
  }

  async getChallenge(id: string, userId: string): Promise<AuthorizationChallenge | null> {
    if (!this.pool) return null;
    await this.schema();
    const result = await this.pool.query(
      `SELECT id,user_id,payload_hash,attempts,max_attempts,expires_at
       FROM transaction_authorization_challenges
       WHERE id=$1 AND user_id=$2 AND consumed_at IS NULL AND expires_at>NOW() AND attempts<max_attempts`,
      [id, userId],
    );
    const row = result.rows[0];
    return row ? {
      id: row.id,
      userId: row.user_id,
      payloadHash: row.payload_hash,
      attempts: Number(row.attempts),
      maxAttempts: Number(row.max_attempts),
      expiresAt: new Date(row.expires_at).toISOString(),
    } : null;
  }

  async recordFailedAttempt(id: string, userId: string): Promise<void> {
    if (!this.pool) return;
    await this.schema();
    await this.pool.query(
      `UPDATE transaction_authorization_challenges
       SET attempts=attempts+1
       WHERE id=$1 AND user_id=$2 AND consumed_at IS NULL AND expires_at>NOW() AND attempts<max_attempts`,
      [id, userId],
    );
  }

  async consumeChallenge(id: string, userId: string): Promise<boolean> {
    if (!this.pool) return false;
    await this.schema();
    const result = await this.pool.query(
      `UPDATE transaction_authorization_challenges
       SET consumed_at=NOW()
       WHERE id=$1 AND user_id=$2 AND consumed_at IS NULL AND expires_at>NOW() AND attempts<max_attempts`,
      [id, userId],
    );
    return result.rowCount === 1;
  }

  async createAuthorization(id: string, userId: string, tokenHash: string, payloadHash: string, expiresAt: string): Promise<void> {
    if (!this.pool) throw new Error('DATABASE_URL is required for transaction authorization');
    await this.schema();
    await this.pool.query(
      `INSERT INTO transaction_authorizations(id,user_id,token_hash,payload_hash,expires_at) VALUES($1,$2,$3,$4,$5)`,
      [id, userId, tokenHash, payloadHash, expiresAt],
    );
  }

  async consumeAuthorization(userId: string, tokenHash: string, payloadHash: string): Promise<boolean> {
    if (!this.pool) return false;
    await this.schema();
    const result = await this.pool.query(
      `UPDATE transaction_authorizations
       SET consumed_at=NOW()
       WHERE user_id=$1 AND token_hash=$2 AND payload_hash=$3
         AND consumed_at IS NULL AND expires_at>NOW()`,
      [userId, tokenHash, payloadHash],
    );
    return result.rowCount === 1;
  }

  async close(): Promise<void> { await this.pool?.end(); }
}
