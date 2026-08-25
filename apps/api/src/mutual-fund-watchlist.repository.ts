import { Pool } from 'pg';

export interface MutualFundWatchlistItem { schemeCode: string; addedAt: string; }

export class MutualFundWatchlistRepository {
  private readonly pool: Pool | null;
  constructor() { const url = process.env.DATABASE_URL; this.pool = url ? new Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30_000 }) : null; }
  private async schema() { if (!this.pool) return; await this.pool.query(`CREATE TABLE IF NOT EXISTS user_mutual_fund_watchlists (user_id TEXT NOT NULL, scheme_code TEXT NOT NULL, added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(user_id, scheme_code));`); }
  async list(userId: string) { if (!this.pool) return []; await this.schema(); const r = await this.pool.query(`SELECT scheme_code, added_at FROM user_mutual_fund_watchlists WHERE user_id=$1 ORDER BY added_at DESC`, [userId]); return r.rows.map(x => ({ schemeCode: x.scheme_code, addedAt: new Date(x.added_at).toISOString() })); }
  async add(userId: string, schemeCode: string) { if (!this.pool) throw new Error('DATABASE_URL is required for mutual-fund watchlists'); await this.schema(); const r = await this.pool.query(`INSERT INTO user_mutual_fund_watchlists(user_id,scheme_code) VALUES($1,$2) ON CONFLICT(user_id,scheme_code) DO UPDATE SET scheme_code=EXCLUDED.scheme_code RETURNING scheme_code,added_at`, [userId, schemeCode]); return { schemeCode: r.rows[0].scheme_code, addedAt: new Date(r.rows[0].added_at).toISOString() }; }
  async remove(userId: string, schemeCode: string) { if (!this.pool) throw new Error('DATABASE_URL is required for mutual-fund watchlists'); await this.schema(); await this.pool.query(`DELETE FROM user_mutual_fund_watchlists WHERE user_id=$1 AND scheme_code=$2`, [userId, schemeCode]); }
}
