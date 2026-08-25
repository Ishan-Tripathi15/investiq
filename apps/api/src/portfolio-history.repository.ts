import { Pool } from 'pg';

export interface PortfolioSnapshot { date: string; value: number; source: string; }

export class PortfolioHistoryRepository {
  private readonly pool: Pool | null;
  private schemaReady = false;

  constructor() {
    const url = process.env.DATABASE_URL;
    this.pool = url ? new Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30_000 }) : null;
  }

  private async ensureSchema(): Promise<void> {
    if (!this.pool || this.schemaReady) return;
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS portfolio_value_snapshots (
        user_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        observed_on DATE NOT NULL,
        observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        value NUMERIC(20, 4) NOT NULL,
        source TEXT NOT NULL,
        PRIMARY KEY (user_id, provider, observed_on)
      );
      CREATE INDEX IF NOT EXISTS idx_portfolio_value_snapshots_lookup
        ON portfolio_value_snapshots(user_id, provider, observed_on DESC);
    `);
    this.schemaReady = true;
  }

  async record(userId: string, provider: string, value: number, observedAt = new Date()): Promise<void> {
    if (!this.pool) throw new Error('Database is required for portfolio history');
    if (!Number.isFinite(value) || value < 0) throw new Error('Portfolio value must be a finite non-negative number');
    await this.ensureSchema();
    await this.pool.query(
      `INSERT INTO portfolio_value_snapshots(user_id, provider, observed_on, observed_at, value, source)
       VALUES($1,$2,$3,$4,$5,$6)
       ON CONFLICT(user_id, provider, observed_on)
       DO UPDATE SET observed_at=$4, value=$5, source=$6`,
      [userId, provider, observedAt.toISOString().slice(0, 10), observedAt.toISOString(), value, `${provider}:verified-account-equity`],
    );
  }

  async list(userId: string, provider: string, days: number): Promise<PortfolioSnapshot[]> {
    if (!this.pool) return [];
    await this.ensureSchema();
    const safeDays = Math.min(Math.max(Math.floor(days), 1), 730);
    const result = await this.pool.query(
      `SELECT observed_on, value, source
       FROM portfolio_value_snapshots
       WHERE user_id=$1 AND provider=$2 AND observed_on >= CURRENT_DATE - ($3::int - 1)
       ORDER BY observed_on ASC`,
      [userId, provider, safeDays],
    );
    return result.rows.map((row) => ({ date: String(row.observed_on), value: Number(row.value), source: String(row.source) }));
  }

  async close(): Promise<void> { await this.pool?.end(); }
}
