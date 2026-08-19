import { Pool } from 'pg';
import type { Order, OrderRequest } from '@investiq/domain';

export type ExecutionRequestStatus = 'processing' | 'completed' | 'failed';

export interface ExecutionRequestRecord {
  idempotencyKey: string;
  orderId?: string;
  status: ExecutionRequestStatus;
  response?: Order;
  errorMessage?: string;
}

export class TradingRepository {
  private readonly pool: Pool | null;

  constructor() {
    const url = process.env.DATABASE_URL;
    this.pool = url ? new Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30_000 }) : null;
  }

  private async ensureSchema(): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS trading_execution_requests (
        idempotency_key TEXT PRIMARY KEY,
        order_id TEXT,
        status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
        request JSONB NOT NULL,
        response JSONB,
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS trading_audit_events (
        id BIGSERIAL PRIMARY KEY,
        event_type TEXT NOT NULL,
        order_id TEXT,
        idempotency_key TEXT,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_trading_audit_events_order_time
        ON trading_audit_events(order_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_trading_audit_events_time
        ON trading_audit_events(created_at DESC);
    `);
  }

  async beginExecution(idempotencyKey: string, request: OrderRequest, orderId: string): Promise<ExecutionRequestRecord | null> {
    if (!this.pool) return null;
    await this.ensureSchema();
    const result = await this.pool.query(
      `INSERT INTO trading_execution_requests(idempotency_key, order_id, status, request)
       VALUES($1, $2, 'processing', $3::jsonb)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING idempotency_key`,
      [idempotencyKey, orderId, JSON.stringify(request)],
    );
    if (result.rowCount === 1) return null;

    const existing = await this.pool.query(
      `SELECT idempotency_key, order_id, status, response, error_message
       FROM trading_execution_requests WHERE idempotency_key = $1`,
      [idempotencyKey],
    );
    const row = existing.rows[0];
    if (!row) return null;
    return {
      idempotencyKey: row.idempotency_key,
      orderId: row.order_id ?? undefined,
      status: row.status as ExecutionRequestStatus,
      response: row.response ? (row.response as Order) : undefined,
      errorMessage: row.error_message ?? undefined,
    };
  }

  async completeExecution(idempotencyKey: string, response: Order): Promise<void> {
    if (!this.pool) return;
    await this.ensureSchema();
    await this.pool.query(
      `UPDATE trading_execution_requests
       SET status = 'completed', response = $2::jsonb, error_message = NULL, updated_at = NOW()
       WHERE idempotency_key = $1`,
      [idempotencyKey, JSON.stringify(response)],
    );
  }

  async failExecution(idempotencyKey: string, errorMessage: string): Promise<void> {
    if (!this.pool) return;
    await this.ensureSchema();
    await this.pool.query(
      `UPDATE trading_execution_requests
       SET status = 'failed', error_message = $2, updated_at = NOW()
       WHERE idempotency_key = $1`,
      [idempotencyKey, errorMessage],
    );
  }

  async audit(eventType: string, payload: Record<string, unknown>, orderId?: string, idempotencyKey?: string): Promise<void> {
    if (!this.pool) return;
    await this.ensureSchema();
    await this.pool.query(
      `INSERT INTO trading_audit_events(event_type, order_id, idempotency_key, payload)
       VALUES($1, $2, $3, $4::jsonb)`,
      [eventType, orderId ?? null, idempotencyKey ?? null, JSON.stringify(payload)],
    );
  }

  async close(): Promise<void> {
    await this.pool?.end();
  }
}
