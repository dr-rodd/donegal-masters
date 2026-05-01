BEGIN;

-- ============================================================
-- Add edition_year discriminator to all partitioned tables
-- Default 2026 so all existing rows are stamped correctly
-- ============================================================

ALTER TABLE teams              ADD COLUMN edition_year INTEGER NOT NULL DEFAULT 2026;
ALTER TABLE players            ADD COLUMN edition_year INTEGER NOT NULL DEFAULT 2026;
ALTER TABLE rounds             ADD COLUMN edition_year INTEGER NOT NULL DEFAULT 2026;
ALTER TABLE round_handicaps    ADD COLUMN edition_year INTEGER NOT NULL DEFAULT 2026;
ALTER TABLE scores             ADD COLUMN edition_year INTEGER NOT NULL DEFAULT 2026;
ALTER TABLE tee_times          ADD COLUMN edition_year INTEGER NOT NULL DEFAULT 2026;
ALTER TABLE live_rounds        ADD COLUMN edition_year INTEGER NOT NULL DEFAULT 2026;
ALTER TABLE live_scores        ADD COLUMN edition_year INTEGER NOT NULL DEFAULT 2026;
ALTER TABLE live_player_locks  ADD COLUMN edition_year INTEGER NOT NULL DEFAULT 2026;
ALTER TABLE composite_holes    ADD COLUMN edition_year INTEGER NOT NULL DEFAULT 2026;

-- ============================================================
-- Indexes for common edition_year queries
-- ============================================================

CREATE INDEX idx_teams_edition_year             ON teams(edition_year);
CREATE INDEX idx_players_edition_year           ON players(edition_year);
CREATE INDEX idx_rounds_edition_year            ON rounds(edition_year);
CREATE INDEX idx_round_handicaps_edition_year   ON round_handicaps(edition_year);
CREATE INDEX idx_scores_edition_year            ON scores(edition_year);
CREATE INDEX idx_tee_times_edition_year         ON tee_times(edition_year);
CREATE INDEX idx_live_rounds_edition_year       ON live_rounds(edition_year);
CREATE INDEX idx_live_scores_edition_year       ON live_scores(edition_year);
CREATE INDEX idx_live_player_locks_edition_year ON live_player_locks(edition_year);
CREATE INDEX idx_composite_holes_edition_year   ON composite_holes(edition_year);

-- ============================================================
-- Tournament config table — tracks which year is "active"
-- ============================================================

CREATE TABLE tournament_config (
  id           SERIAL PRIMARY KEY,
  current_year INTEGER NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO tournament_config (current_year) VALUES (2026);

-- ============================================================
-- settings is NOT partitioned (workflow state, not historical data).
-- teams_locked reset will happen in the reset_for_2027 migration,
-- alongside bumping tournament_config.current_year to 2027.
-- ============================================================

COMMIT;
