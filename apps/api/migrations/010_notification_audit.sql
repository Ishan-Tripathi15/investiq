CREATE TABLE IF NOT EXISTS notification_audit_events (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  notification_id BIGINT,
  event_type TEXT NOT NULL,
  status TEXT,
  provider TEXT,
  attempt_count INTEGER,
  error_code TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notification_audit_user_created ON notification_audit_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_audit_notification ON notification_audit_events(notification_id, created_at DESC);
