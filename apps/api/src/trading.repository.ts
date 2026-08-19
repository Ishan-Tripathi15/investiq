import { Pool } from 'pg';
import type { Order, OrderRequest } from '@investiq/domain';
import type { TradingEvent, TradingEventType } from './trading-events.types';

export type ExecutionRequestStatus = 'processing' | 'completed' | 'failed';

export interface ExecutionRequestRecord {
  idempotencyKey: string;
  userId?: string;
  orderId?: string;
  status: ExecutionRequestStatus;
  request?: OrderRequest;
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
        idempotency_key TEXT PRIMARY KEY, user_id TEXT, order_id TEXT,
        status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
        request JSONB NOT NULL, response JSONB, error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE trading_execution_requests ADD COLUMN IF NOT EXISTS user_id TEXT;
      CREATE TABLE IF NOT EXISTS trading_audit_events (
        id BIGSERIAL PRIMARY KEY, event_type TEXT NOT NULL, user_id TEXT, order_id TEXT, idempotency_key TEXT,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE trading_audit_events ADD COLUMN IF NOT EXISTS user_id TEXT;
      CREATE INDEX IF NOT EXISTS idx_trading_audit_events_order_time ON trading_audit_events(order_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_trading_audit_events_time ON trading_audit_events(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_trading_execution_requests_user_updated ON trading_execution_requests(user_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_trading_audit_events_user_id ON trading_audit_events(user_id, id ASC);
    `);
  }

  async beginExecution(userId: string, idempotencyKey: string, request: OrderRequest, orderId: string): Promise<ExecutionRequestRecord | null> {
    if (!this.pool) return null;
    await this.ensureSchema();
    const result = await this.pool.query(
      `INSERT INTO trading_execution_requests(idempotency_key, user_id, order_id, status, request)
       VALUES($1, $2, $3, 'processing', $4::jsonb)
       ON CONFLICT (idempotency_key) DO NOTHING RETURNING idempotency_key`,
      [idempotencyKey, userId, orderId, JSON.stringify(request)],
    );
    if (result.rowCount === 1) return null;
    const existing = await this.pool.query(
      `SELECT idempotency_key, user_id, order_id, status, request, response, error_message
       FROM trading_execution_requests WHERE idempotency_key = $1`, [idempotencyKey]);
    const row = existing.rows[0];
    if (!row) return null;
    return {
      idempotencyKey: row.idempotency_key, userId: row.user_id ?? undefined, orderId: row.order_id ?? undefined,
      status: row.status as ExecutionRequestStatus, request: row.request as OrderRequest,
      response: row.response ? row.response as Order : undefined, errorMessage: row.error_message ?? undefined,
    };
  }

  async listExecutionRequests(userId?: string, limit = 100): Promise<ExecutionRequestRecord[]> {
    if (!this.pool) return [];
    await this.ensureSchema();
    const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
    const result = await this.pool.query(
      `SELECT idempotency_key, user_id, order_id, status, request, response, error_message
       FROM trading_execution_requests WHERE ($1::text IS NULL OR user_id = $1)
       ORDER BY updated_at DESC LIMIT $2`, [userId ?? null, safeLimit]);
    return result.rows.map((row) => ({
      idempotencyKey: row.idempotency_key, userId: row.user_id ?? undefined, orderId: row.order_id ?? undefined,
      status: row.status as ExecutionRequestStatus, request: row.request as OrderRequest,
      response: row.response ? row.response as Order : undefined, errorMessage: row.error_message ?? undefined,
    }));
  }

  async listAuditEvents(userId: string | undefined, afterId = 0, limit = 100): Promise<TradingEvent[]> {
    if (!this.pool) return [];
    await this.ensureSchema();
    const safeAfterId = Number.isFinite(afterId) && afterId > 0 ? Math.floor(afterId) : 0;
    const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
    const result = await this.pool.query(
      `SELECT id, event_type, order_id, idempotency_key, payload, created_at FROM trading_audit_events
       WHERE id > $1 AND ($2::text IS NULL OR user_id = $2) ORDER BY id ASC LIMIT $3`,
      [safeAfterId, userId ?? null, safeLimit]);
    return result.rows.map((row) => ({
      id: Number(row.id), type: row.event_type as TradingEventType, orderId: row.order_id ?? undefined,
      idempotencyKey: row.idempotency_key ?? undefined, payload: (row.payload ?? {}) as Record<string, unknown>,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }

  async completeExecution(idempotencyKey: string, response: Order): Promise<void> {
    if (!this.pool) return; await this.ensureSchema();
    await this.pool.query(`UPDATE trading_execution_requests SET status='completed', response=$2::jsonb, error_message=NULL, updated_at=NOW() WHERE idempotency_key=$1`, [idempotencyKey, JSON.stringify(response)]);
  }

  async failExecution(idempotencyKey: string, errorMessage: string): Promise<void> {
    if (!this.pool) return; await this.ensureSchema();
    await this.pool.query(`UPDATE trading_execution_requests SET status='failed', error_message=$2, updated_at=NOW() WHERE idempotency_key=$1`, [idempotencyKey, errorMessage]);
  }

  async audit(userId: string | undefined, eventType: string, payload: Record<string, unknown>, orderId?: string, idempotencyKey?: string): Promise<void> {
    if (!this.pool) return; await this.ensureSchema();
    await this.pool.query(`INSERT INTO trading_audit_events(event_type,user_id,order_id,idempotency_key,payload) VALUES($1,$2,$3,$4,$5::jsonb)`, [eventType, userId ?? null, orderId ?? null, idempotencyKey ?? null, JSON.stringify(payload)]);
  }
  async close(): Promise<void> { await this.pool?.end(); }
}
