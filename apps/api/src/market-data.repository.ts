import { Pool } from 'pg';
import { HistoricalPoint } from './market-data.types';

export class MarketDataRepository {
  private readonly pool: Pool | null;

  constructor() {
    const url = process.env.DATABASE_URL;
    this.pool = url ? new Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30_000 }) : null;
  }

  async ensureSchema(): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS market_price_history (
        symbol TEXT NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL,
        open DOUBLE PRECISION,
        high DOUBLE PRECISION,
        low DOUBLE PRECISION,
        close DOUBLE PRECISION NOT NULL,
        volume DOUBLE PRECISION,
        provider TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (symbol, timestamp)
      );
      CREATE INDEX IF NOT EXISTS idx_market_price_history_symbol_time
        ON market_price_history(symbol, timestamp DESC);
    `);
  }

  async upsert(symbol: string, points: HistoricalPoint[], provider: string): Promise<void> {
    if (!this.pool || points.length === 0) return;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const point of points) {
        await client.query(
          `INSERT INTO market_price_history(symbol, timestamp, open, high, low, close, volume, provider)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT(symbol,timestamp) DO UPDATE SET
             open=EXCLUDED.open, high=EXCLUDED.high, low=EXCLUDED.low,
             close=EXCLUDED.close, volume=EXCLUDED.volume, provider=EXCLUDED.provider`,
          [symbol.toUpperCase(), point.timestamp, point.open ?? null, point.high ?? null,
            point.low ?? null, point.close, point.volume ?? null, provider],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async get(symbol: string, from?: string, to?: string): Promise<HistoricalPoint[]> {
    if (!this.pool) return [];
    const result = await this.pool.query(
      `SELECT timestamp, open, high, low, close, volume
       FROM market_price_history
       WHERE symbol = $1
         AND ($2::timestamptz IS NULL OR timestamp >= $2)
         AND ($3::timestamptz IS NULL OR timestamp <= $3)
       ORDER BY timestamp ASC`,
      [symbol.toUpperCase(), from ?? null, to ?? null],
    );
    return result.rows.map((row) => ({
      timestamp: new Date(row.timestamp).toISOString(),
      open: row.open == null ? undefined : Number(row.open),
      high: row.high == null ? undefined : Number(row.high),
      low: row.low == null ? undefined : Number(row.low),
      close: Number(row.close),
      volume: row.volume == null ? undefined : Number(row.volume),
    }));
  }

  async close(): Promise<void> {
    await this.pool?.end();
  }
}
