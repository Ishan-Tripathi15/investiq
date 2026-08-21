import { Pool } from 'pg';

export interface PortfolioMemorySnapshot {
  equity: number;
  cashValue: number;
  cashPct: number;
  concentrationPct: number;
  riskLevel: string;
  largestPosition?: { symbol: string; weightPct: number };
}

export interface PortfolioMemoryRecord {
  id: number;
  question: string;
  answer: string;
  createdAt: string;
  snapshot: PortfolioMemorySnapshot;
}

export class PortfolioMemoryRepository {
  private readonly pool: Pool | null;

  constructor() {
    const url = process.env.DATABASE_URL;
    this.pool = url ? new Pool({ connectionString: url, max: 5, idleTimeoutMillis: 30_000 }) : null;
  }

  private async ensureSchema(): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS portfolio_copilot_memory (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        response JSONB NOT NULL DEFAULT '{}'::jsonb,
        portfolio_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_portfolio_copilot_memory_user_time
        ON portfolio_copilot_memory(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_portfolio_copilot_memory_user_id
        ON portfolio_copilot_memory(user_id, id DESC);
    `);
  }

  async add(
    userId: string,
    question: string,
    answer: string,
    response: Record<string, unknown>,
    snapshot: PortfolioMemorySnapshot,
  ): Promise<void> {
    if (!this.pool) return;
    await this.ensureSchema();
    await this.pool.query(
      `INSERT INTO portfolio_copilot_memory(user_id, question, answer, response, portfolio_snapshot)
       VALUES($1, $2, $3, $4::jsonb, $5::jsonb)`,
      [userId, question, answer, JSON.stringify(response), JSON.stringify(snapshot)],
    );
  }

  async listRelevant(userId: string, question: string, limit = 5): Promise<PortfolioMemoryRecord[]> {
    if (!this.pool) return [];
    await this.ensureSchema();
    const safeLimit = Math.max(1, Math.min(10, Math.floor(limit)));
    const result = await this.pool.query(
      `SELECT id, question, answer, created_at, portfolio_snapshot
       FROM portfolio_copilot_memory
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 30`,
      [userId],
    );

    const tokens = [...new Set((question.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []))];
    const now = Date.now();
    return result.rows
      .map((row, index) => {
        const text = `${row.question} ${row.answer}`.toLowerCase();
        const overlap = tokens.reduce((score, token) => score + (text.includes(token) ? 1 : 0), 0);
        const ageHours = Math.max(0, (now - new Date(row.created_at).getTime()) / 3_600_000);
        const recency = Math.max(0, 1 - ageHours / (24 * 30));
        return {
          score: overlap * 3 + recency + (index === 0 ? 0.25 : 0),
          record: {
            id: Number(row.id),
            question: row.question,
            answer: row.answer,
            createdAt: new Date(row.created_at).toISOString(),
            snapshot: (row.portfolio_snapshot ?? {}) as PortfolioMemorySnapshot,
          },
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, safeLimit)
      .map((item) => item.record);
  }

  async clear(userId: string): Promise<number> {
    if (!this.pool) return 0;
    await this.ensureSchema();
    const result = await this.pool.query('DELETE FROM portfolio_copilot_memory WHERE user_id = $1', [userId]);
    return result.rowCount ?? 0;
  }

  async close(): Promise<void> { await this.pool?.end(); }
}
