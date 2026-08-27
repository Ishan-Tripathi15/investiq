ALTER TABLE notification_deliveries ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;
ALTER TABLE notification_deliveries ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;
ALTER TABLE notification_deliveries ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 3;
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_retry ON notification_deliveries(status, next_attempt_at) WHERE status IN ('failed','queued');
