CREATE TABLE IF NOT EXISTS security_activity (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  request_id TEXT,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_activity_user_time
  ON security_activity(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_activity_type_time
  ON security_activity(event_type, created_at DESC);
