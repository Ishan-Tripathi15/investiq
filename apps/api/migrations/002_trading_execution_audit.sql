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

CREATE INDEX IF NOT EXISTS idx_trading_execution_requests_order_id
  ON trading_execution_requests(order_id);

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
