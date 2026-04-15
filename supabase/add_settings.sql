-- Settings table for persisted app config
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL DEFAULT 'null'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed the teams_locked flag (false = unlocked by default)
INSERT INTO settings (key, value)
VALUES ('teams_locked', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;
