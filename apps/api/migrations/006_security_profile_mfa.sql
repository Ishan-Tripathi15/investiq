CREATE TABLE IF NOT EXISTS user_mfa (
  user_id TEXT PRIMARY KEY,
  secret_ciphertext TEXT NOT NULL,
  enabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_mfa_challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  challenge_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auth_mfa_challenges_active ON auth_mfa_challenges(challenge_hash, expires_at) WHERE consumed_at IS NULL;

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY,
  full_name_ciphertext TEXT,
  date_of_birth_ciphertext TEXT,
  email_ciphertext TEXT,
  phone_ciphertext TEXT,
  pan_ciphertext TEXT,
  address_ciphertext TEXT,
  city_ciphertext TEXT,
  state_ciphertext TEXT,
  postal_code_ciphertext TEXT,
  country_ciphertext TEXT,
  occupation_ciphertext TEXT,
  risk_profile TEXT,
  nominee_ciphertext TEXT,
  kyc_status TEXT NOT NULL DEFAULT 'not_started',
  kyc_provider TEXT,
  kyc_reference TEXT,
  kyc_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_profiles_kyc_status ON user_profiles(kyc_status);
