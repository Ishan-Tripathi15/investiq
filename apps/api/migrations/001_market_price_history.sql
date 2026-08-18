CREATE TABLE IF NOT EXISTS market_price_history (
  symbol TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  open DOUBLE PRECISION,
  high DOUBLE PRECISION,
  low DOUBLE PRECISION,
  close DOUBLE PRECISION NOT NULL,
  volume DOUBLE PRECISION,
  provider TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (symbol, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_market_price_history_symbol_time
  ON market_price_history(symbol, timestamp DESC);
