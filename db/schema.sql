CREATE TABLE IF NOT EXISTS vin_lookups (
  id SERIAL PRIMARY KEY,
  vin VARCHAR(17) NOT NULL UNIQUE,
  vin_data JSONB,
  recalls_data JSONB,
  complaints_data JSONB,
  market_data JSONB,
  images_data JSONB,
  ai_summary TEXT,
  lookup_count INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vin_lookups_vin ON vin_lookups(vin);
CREATE INDEX IF NOT EXISTS idx_vin_lookups_updated ON vin_lookups(updated_at DESC);
