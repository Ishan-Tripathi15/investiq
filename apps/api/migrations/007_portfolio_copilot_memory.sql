CREATE TABLE IF NOT EXISTS portfolio_copilot_memory (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  response JSONB NOT NULL DEFAULT '{}'::jsonb,
  portfolio_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_copilot_memory_user_time
  ON portfolio_copilot_memory(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_portfolio_copilot_memory_user_id
  ON portfolio_copilot_memory(user_id, id DESC);
