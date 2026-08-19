CREATE TABLE IF NOT EXISTS broker_oauth_states (
  state_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_broker_oauth_states_expiry
  ON broker_oauth_states(expires_at);

CREATE TABLE IF NOT EXISTS broker_connections (
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  broker_user_id TEXT NOT NULL,
  encrypted_access_token TEXT NOT NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_broker_connections_provider
  ON broker_connections(provider, updated_at DESC);
