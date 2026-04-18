-- Add blinded flag to live_rounds so settings can hide score details until slowest player catches up
ALTER TABLE live_rounds ADD COLUMN IF NOT EXISTS blinded boolean NOT NULL DEFAULT false;
