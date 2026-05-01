-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: flip_to_2027.sql
-- Purpose:   Archive the 2026 tournament and open the 2027 edition.
--            Sets current_year = 2027 in tournament_config so all edition_year-
--            partitioned queries now operate on the 2027 data set (which is
--            empty until teams, players, and rounds are seeded for 2027).
--            Resets teams_locked to false so the 2027 team roster can be edited.
--            2026 data is untouched — archive queries filter by edition_year = 2026.
-- Run:       23 Apr 2026
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

UPDATE tournament_config SET current_year = 2027;
UPDATE settings SET value = 'false' WHERE key = 'teams_locked';

COMMIT;
