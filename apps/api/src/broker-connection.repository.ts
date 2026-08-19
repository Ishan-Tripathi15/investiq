import { Pool } from 'pg';

export interface BrokerConnectionRecord {
  userId: string;
  provider: string;
  brokerUserId: string;
  encryptedAccessToken: string;
  connectedAt: string;
  updatedAt: string;
}

export class BrokerConnectionRepository {
  private readonly pool: Pool | null;

  constructor() {
    const url = process.env.DATABASE_URL;
    this.pool = url ? new Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30_000 }) : null;
  }

  private async ensureSchema(): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS broker_oauth_states (
        state_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_broker_oauth_states_expiry ON broker_oauth_states(expires_at);
      CREATE TABLE IF NOT EXISTS broker_connections (
        user_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        broker_user_id TEXT NOT NULL,
        encrypted_access_token TEXT NOT NULL,
        connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, provider)
      );
      CREATE INDEX IF NOT EXISTS idx_broker_connections_provider ON broker_connections(provider, updated_at DESC);
    `);
  }

  async createOAuthState(stateHash: string, userId: string, provider: string, expiresAt: Date): Promise<void> {
    if (!this.pool) throw new Error('Database is required for broker connection state');
    await this.ensureSchema();
    await this.pool.query(
      `INSERT INTO broker_oauth_states(state_hash, user_id, provider, expires_at) VALUES($1,$2,$3,$4)`,
      [stateHash, userId, provider, expiresAt.toISOString()],
    );
  }

  async consumeOAuthState(stateHash: string, provider: string): Promise<string | null> {
    if (!this.pool) return null;
    await this.ensureSchema();
    const result = await this.pool.query(
      `UPDATE broker_oauth_states
       SET consumed_at = NOW()
       WHERE state_hash = $1 AND provider = $2 AND consumed_at IS NULL AND expires_at > NOW()
       RETURNING user_id`,
      [stateHash, provider],
    );
    return result.rowCount === 1 ? String(result.rows[0].user_id) : null;
  }

  async upsertConnection(userId: string, provider: string, brokerUserId: string, encryptedAccessToken: string): Promise<void> {
    if (!this.pool) throw new Error('Database is required for broker connections');
    await this.ensureSchema();
    await this.pool.query(
      `INSERT INTO broker_connections(user_id, provider, broker_user_id, encrypted_access_token)
       VALUES($1,$2,$3,$4)
       ON CONFLICT(user_id, provider) DO UPDATE SET broker_user_id=$3, encrypted_access_token=$4, updated_at=NOW()`,
      [userId, provider, brokerUserId, encryptedAccessToken],
    );
  }

  async getConnection(userId: string, provider: string): Promise<BrokerConnectionRecord | null> {
    if (!this.pool) return null;
    await this.ensureSchema();
    const result = await this.pool.query(
      `SELECT user_id, provider, broker_user_id, encrypted_access_token, connected_at, updated_at
       FROM broker_connections WHERE user_id=$1 AND provider=$2`,
      [userId, provider],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      userId: String(row.user_id),
      provider: String(row.provider),
      brokerUserId: String(row.broker_user_id),
      encryptedAccessToken: String(row.encrypted_access_token),
      connectedAt: new Date(row.connected_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }

  async disconnect(userId: string, provider: string): Promise<void> {
    if (!this.pool) return;
    await this.ensureSchema();
    await this.pool.query(`DELETE FROM broker_connections WHERE user_id=$1 AND provider=$2`, [userId, provider]);
  }

  async close(): Promise<void> {
    await this.pool?.end();
  }
}
