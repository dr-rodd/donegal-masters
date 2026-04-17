-- ============================================================
-- ULSTER TRIP ("Ports") — Schema + Seed
-- Migration: 0001_ulster_schema.sql
--
-- CRITICAL: No hole counts are hardcoded anywhere in this file.
-- All hole-count-dependent logic derives from the length of the
-- pars / yardages / stroke_index arrays on ulster_course_tees.
-- ============================================================


-- ============================================================
-- TABLES
-- ============================================================

-- Single-row config table for the trip
CREATE TABLE ulster_trip (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL DEFAULT 'Ports',
  reveal_at   TIMESTAMPTZ NOT NULL DEFAULT '2026-04-19 15:00:00+01',
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE ulster_courses (
  id         UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT  UNIQUE NOT NULL,
  name       TEXT  NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- One row per tee set per course.
-- Hole count = array_length(pars, 1) — never assume 18.
CREATE TABLE ulster_course_tees (
  id            UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id     UUID           NOT NULL REFERENCES ulster_courses(id) ON DELETE CASCADE,
  tee_name      TEXT           NOT NULL,
  gender        TEXT           NOT NULL CHECK (gender IN ('men', 'women')),
  total_yards   INT            NOT NULL,
  course_rating NUMERIC(4,1)   NOT NULL,
  slope_rating  INT            NOT NULL,
  par_front     INT            NOT NULL,
  par_back      INT            NOT NULL,
  par_total     INT            NOT NULL,
  yardages      INT[]          NOT NULL,
  pars          INT[]          NOT NULL,
  stroke_index  INT[]          NOT NULL,

  CONSTRAINT uq_ulster_course_tees UNIQUE (course_id, tee_name, gender),

  -- All three arrays must have the same length (i.e. same number of holes)
  CONSTRAINT chk_array_lengths CHECK (
    array_length(pars, 1) = array_length(yardages, 1)
    AND array_length(pars, 1) = array_length(stroke_index, 1)
  )
);

-- Ulster-specific player roster (subset of main players table)
CREATE TABLE ulster_players (
  id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id        UUID           NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  handicap_index   NUMERIC(4,1)   NOT NULL,
  created_at       TIMESTAMPTZ    DEFAULT now(),

  CONSTRAINT uq_ulster_players_player UNIQUE (player_id)
);

-- Matches: 4bbb matchplay, strokeplay, or bbb aggregate
CREATE TABLE ulster_matches (
  id              UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT,
  match_date      DATE     NOT NULL,
  course_id       UUID     REFERENCES ulster_courses(id),
  tee_id          UUID     REFERENCES ulster_course_tees(id),
  format          TEXT     NOT NULL CHECK (format IN ('4bbb_matchplay', 'strokeplay_cumulative', 'bbb_agg')),
  hcp_allowance   INT      NOT NULL DEFAULT 100 CHECK (hcp_allowance IN (85, 100)),
  agg_holes       INT,
  team_a_players  UUID[]   NOT NULL,
  team_b_players  UUID[]   NOT NULL,
  conceded_holes  JSONB    DEFAULT '{}'::JSONB,
  status          TEXT     NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'live', 'complete')),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- One row per player per hole per match
CREATE TABLE ulster_scores (
  id         UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id   UUID  NOT NULL REFERENCES ulster_matches(id) ON DELETE CASCADE,
  player_id  UUID  NOT NULL REFERENCES ulster_players(id) ON DELETE CASCADE,
  hole       INT   NOT NULL CHECK (hole >= 1),
  gross      INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT uq_ulster_scores UNIQUE (match_id, player_id, hole)
);


-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_ulster_scores_match        ON ulster_scores (match_id);
CREATE INDEX idx_ulster_scores_match_player ON ulster_scores (match_id, player_id);
CREATE INDEX idx_ulster_matches_date        ON ulster_matches (match_date);
CREATE INDEX idx_ulster_matches_status      ON ulster_matches (status);


-- ============================================================
-- TRIGGER: updated_at on ulster_scores
-- Reuses the set_updated_at() function from the main schema.
-- ============================================================

CREATE TRIGGER trg_ulster_scores_updated_at
  BEFORE UPDATE ON ulster_scores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- SEED: ulster_trip
-- ============================================================

INSERT INTO ulster_trip (name, reveal_at)
VALUES ('Ports', '2026-04-19 15:00:00+01');


-- ============================================================
-- SEED: ulster_courses
-- ============================================================

INSERT INTO ulster_courses (slug, name) VALUES
  ('portstewart_strand',    'Portstewart Golf Club — Strand Course'),
  ('royal_portrush_dunluce','Royal Portrush — Dunluce Links');


-- ============================================================
-- SEED: ulster_course_tees — PORTSTEWART STRAND
--
-- Men's pars:   [4,4,3,5,4,3,5,4,4, 4,4,3,5,4,3,4,4,4]  front=36 back=35 total=71
-- Women's pars: [5,4,3,5,4,3,5,4,4, 4,4,3,5,4,3,4,5,4]  front=37 back=36 total=73
-- Men's SI:     [11,7,13,5,1,15,17,3,9, 10,4,18,16,12,14,6,2,8]
-- Ladies' SI:   [7,1,17,9,3,13,11,5,15, 2,14,18,6,8,16,4,12,10]
--
-- Yardage totals verified:
--   Black  7043  Blue  6604  White  6075  Gold  5730
-- ============================================================

-- Black tees (men)
INSERT INTO ulster_course_tees
  (course_id, tee_name, gender, total_yards, course_rating, slope_rating,
   par_front, par_back, par_total, yardages, pars, stroke_index)
VALUES (
  (SELECT id FROM ulster_courses WHERE slug = 'portstewart_strand'),
  'Black', 'men', 7043, 74.2, 131, 36, 35, 71,
  ARRAY[427,366,218,583,461,143,516,445,378, 413,407,167,556,460,168,418,446,471],
  ARRAY[4,4,3,5,4,3,5,4,4, 4,4,3,5,4,3,4,4,4],
  ARRAY[11,7,13,5,1,15,17,3,9, 10,4,18,16,12,14,6,2,8]
);

-- Blue tees (men)
INSERT INTO ulster_course_tees
  (course_id, tee_name, gender, total_yards, course_rating, slope_rating,
   par_front, par_back, par_total, yardages, pars, stroke_index)
VALUES (
  (SELECT id FROM ulster_courses WHERE slug = 'portstewart_strand'),
  'Blue', 'men', 6604, 72.6, 127, 36, 35, 71,
  ARRAY[417,360,205,522,449,135,475,411,350, 396,376,154,535,430,148,389,428,424],
  ARRAY[4,4,3,5,4,3,5,4,4, 4,4,3,5,4,3,4,4,4],
  ARRAY[11,7,13,5,1,15,17,3,9, 10,4,18,16,12,14,6,2,8]
);

-- White tees (men)
INSERT INTO ulster_course_tees
  (course_id, tee_name, gender, total_yards, course_rating, slope_rating,
   par_front, par_back, par_total, yardages, pars, stroke_index)
VALUES (
  (SELECT id FROM ulster_courses WHERE slug = 'portstewart_strand'),
  'White', 'men', 6075, 69.5, 117, 36, 35, 71,
  ARRAY[409,322,174,503,431,120,445,382,272, 384,318,146,502,390,123,370,388,396],
  ARRAY[4,4,3,5,4,3,5,4,4, 4,4,3,5,4,3,4,4,4],
  ARRAY[11,7,13,5,1,15,17,3,9, 10,4,18,16,12,14,6,2,8]
);

-- White tees (women) — same yardages as men's White, ladies pars/SI/rating
INSERT INTO ulster_course_tees
  (course_id, tee_name, gender, total_yards, course_rating, slope_rating,
   par_front, par_back, par_total, yardages, pars, stroke_index)
VALUES (
  (SELECT id FROM ulster_courses WHERE slug = 'portstewart_strand'),
  'White', 'women', 6075, 75.7, 128, 37, 36, 73,
  ARRAY[409,322,174,503,431,120,445,382,272, 384,318,146,502,390,123,370,388,396],
  ARRAY[5,4,3,5,4,3,5,4,4, 4,4,3,5,4,3,4,5,4],
  ARRAY[7,1,17,9,3,13,11,5,15, 2,14,18,6,8,16,4,12,10]
);

-- Gold tees (women)
INSERT INTO ulster_course_tees
  (course_id, tee_name, gender, total_yards, course_rating, slope_rating,
   par_front, par_back, par_total, yardages, pars, stroke_index)
VALUES (
  (SELECT id FROM ulster_courses WHERE slug = 'portstewart_strand'),
  'Gold', 'women', 5730, 73.8, 123, 37, 36, 73,
  ARRAY[400,347,166,442,334,110,423,357,268, 370,312,140,459,345,104,363,419,371],
  ARRAY[5,4,3,5,4,3,5,4,4, 4,4,3,5,4,3,4,5,4],
  ARRAY[7,1,17,9,3,13,11,5,15, 2,14,18,6,8,16,4,12,10]
);


-- ============================================================
-- SEED: ulster_course_tees — ROYAL PORTRUSH DUNLUCE
--
-- PLACEHOLDER — confirm all values from physical scorecard.
--
-- Note: par_front/par_back as stated in brief are 35/36, but the
-- supplied pars array sums to front=36 back=35 total=71.
-- Using array-derived values (36/35) as source of truth.
-- Note: total_yards stated as 7344 but array sums to 7381 —
-- using stated 7344 pending scorecard confirmation.
-- ============================================================

INSERT INTO ulster_course_tees
  (course_id, tee_name, gender, total_yards, course_rating, slope_rating,
   par_front, par_back, par_total, yardages, pars, stroke_index)
VALUES (
  (SELECT id FROM ulster_courses WHERE slug = 'royal_portrush_dunluce'),
  'Championship', 'men', 7344, 70.0, 131, 36, 35, 71,
  ARRAY[420,575,176,502,372,193,607,434,432, 450,475,525,199,442,460,236,409,474],
  ARRAY[4,5,3,4,4,3,5,4,4, 4,4,4,3,4,4,3,4,5],
  ARRAY[1,5,17,7,11,15,3,9,13, 8,6,4,18,12,10,14,2,16]
);


-- ============================================================
-- SEED: ulster_players
--
-- Selects from the main players table by first name (case-insensitive).
-- Each INSERT is guarded: if 0 or >1 player matches the name,
-- the subquery returns no rows and the insert is silently skipped —
-- Big Dog will populate missing players manually via Settings tab.
-- ============================================================

-- Dave
INSERT INTO ulster_players (player_id, handicap_index)
SELECT id, handicap FROM players
WHERE lower(name) = 'dave'
  AND (SELECT count(*) FROM players WHERE lower(name) = 'dave') = 1;

-- Ross
INSERT INTO ulster_players (player_id, handicap_index)
SELECT id, handicap FROM players
WHERE lower(name) = 'ross'
  AND (SELECT count(*) FROM players WHERE lower(name) = 'ross') = 1;

-- Liz
INSERT INTO ulster_players (player_id, handicap_index)
SELECT id, handicap FROM players
WHERE lower(name) = 'liz'
  AND (SELECT count(*) FROM players WHERE lower(name) = 'liz') = 1;

-- Paul
INSERT INTO ulster_players (player_id, handicap_index)
SELECT id, handicap FROM players
WHERE lower(name) = 'paul'
  AND (SELECT count(*) FROM players WHERE lower(name) = 'paul') = 1;
