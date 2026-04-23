-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: seed_2027_teams_players.sql
-- Purpose:   Copy the 2026 team names/colours and player roster (name, role,
--            handicap, gender) into edition_year = 2027 so the Teams page is
--            pre-populated and handicaps only need adjusting rather than
--            re-entering from scratch.
--            All players start with team_id = NULL — team assignments are made
--            fresh in the Teams UI for the new edition.
--            No scores, rounds, or live data are created here.
-- Run:       23 Apr 2026
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Teams ──────────────────────────────────────────────────────────────────

INSERT INTO teams (id, name, color, edition_year) VALUES
  (gen_random_uuid(), 'Team Eastwood',   '#EC4899', 2027),
  (gen_random_uuid(), 'Team Gibson',     '#10B981', 2027),
  (gen_random_uuid(), 'Team McKay',      '#3B82F6', 2027),
  (gen_random_uuid(), 'Team Villeneuve', '#F59E0B', 2027);

-- ── Players (team_id NULL — assigned via Teams UI) ─────────────────────────

INSERT INTO players (id, name, role, handicap, gender, is_composite, team_id, edition_year) VALUES
  (gen_random_uuid(), 'Aisling',   'mum', 21.1, 'F', false, NULL, 2027),
  (gen_random_uuid(), 'Dave',      'son',  3.0, 'M', false, NULL, 2027),
  (gen_random_uuid(), 'Eithne',    'mum', 25.0, 'F', false, NULL, 2027),
  (gen_random_uuid(), 'Gillian',   'mum', 22.9, 'F', false, NULL, 2027),
  (gen_random_uuid(), 'John',      'dad', 12.1, 'M', false, NULL, 2027),
  (gen_random_uuid(), 'Liz',       'mum', 23.4, 'F', false, NULL, 2027),
  (gen_random_uuid(), 'Martin',    'dad', 14.2, 'M', false, NULL, 2027),
  (gen_random_uuid(), 'Mary Ruth', 'son', 18.9, 'F', false, NULL, 2027),
  (gen_random_uuid(), 'Matthew',   'son',  5.4, 'M', false, NULL, 2027),
  (gen_random_uuid(), 'Paul',      'dad', 14.6, 'M', false, NULL, 2027),
  (gen_random_uuid(), 'Peter',     'dad', 17.0, 'M', false, NULL, 2027),
  (gen_random_uuid(), 'Ross',      'son',  9.4, 'M', false, NULL, 2027);

COMMIT;
