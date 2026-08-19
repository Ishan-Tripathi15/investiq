CREATE TABLE IF NOT EXISTS security_notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_notifications_user_time
  ON security_notifications(user_id, id DESC);

CREATE INDEX IF NOT EXISTS idx_security_notifications_user_unread
  ON security_notifications(user_id, id DESC)
  WHERE read_at IS NULL;
