ALTER TABLE security_notifications ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_security_notifications_idempotency ON security_notifications(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
