ALTER TABLE auth_sessions
  ADD COLUMN IF NOT EXISTS device_id_hash TEXT,
  ADD COLUMN IF NOT EXISTS device_label TEXT,
  ADD COLUMN IF NOT EXISTS ip_address INET,
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_active_created
  ON auth_sessions(user_id, revoked_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_device
  ON auth_sessions(user_id, device_id_hash)
  WHERE revoked_at IS NULL;
