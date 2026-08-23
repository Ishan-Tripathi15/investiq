import { Pool } from 'pg';
import { WatchlistItem } from './watchlist.types';

export class WatchlistRepository {
  private readonly pool: Pool | null;
  constructor() { const url = process.env.DATABASE_URL; this.pool = url ? new Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30_000 }) : null; }
  private async schema() {
    if (!this.pool) return;
    await this.pool.query(`CREATE TABLE IF NOT EXISTS user_watchlists (user_id TEXT NOT NULL, symbol TEXT NOT NULL, added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(user_id, symbol));`);
  }
  async list(userId: string): Promise<WatchlistItem[]> {
    if (!this.pool) return [];
    await this.schema();
    const result = await this.pool.query(`SELECT symbol, added_at FROM user_watchlists WHERE user_id=$1 ORDER BY added_at DESC`, [userId]);
    return result.rows.map(row => ({ symbol: row.symbol, addedAt: new Date(row.added_at).toISOString() }));
  }
  async add(userId: string, symbol: string): Promise<WatchlistItem> {
    if (!this.pool) throw new Error('DATABASE_URL is required for watchlists');
    await this.schema();
    const result = await this.pool.query(`INSERT INTO user_watchlists(user_id,symbol) VALUES($1,$2) ON CONFLICT(user_id,symbol) DO UPDATE SET symbol=EXCLUDED.symbol RETURNING symbol,added_at`, [userId, symbol]);
    return { symbol: result.rows[0].symbol, addedAt: new Date(result.rows[0].added_at).toISOString() };
  }
  async remove(userId: string, symbol: string): Promise<void> {
    if (!this.pool) throw new Error('DATABASE_URL is required for watchlists');
    await this.schema();
    await this.pool.query(`DELETE FROM user_watchlists WHERE user_id=$1 AND symbol=$2`, [userId, symbol]);
  }
}
