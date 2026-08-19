ALTER TABLE trading_execution_requests
  ADD COLUMN IF NOT EXISTS user_id TEXT;

ALTER TABLE trading_audit_events
  ADD COLUMN IF NOT EXISTS user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_trading_execution_requests_user_updated
  ON trading_execution_requests(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_trading_audit_events_user_id
  ON trading_audit_events(user_id, id ASC);
