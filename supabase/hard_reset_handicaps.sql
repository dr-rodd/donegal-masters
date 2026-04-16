-- ============================================================
-- HARD RESET: Player handicap indices, genders, and
-- playing handicaps for all 3 rounds.
-- Formula: PH = ROUND(HI × Slope/113 + (CR − par))
-- No 95% allowance. Gender-appropriate tees throughout.
--
-- R1 = Old Tom Morris   (22222222-0000-0000-0000-000000000001)
-- R2 = St Patrick's     (22222222-0000-0000-0000-000000000002)
-- R3 = Sandy Hills      (22222222-0000-0000-0000-000000000003)
-- ============================================================


-- ============================================================
-- STEP 1: Update player handicap indices and genders
-- Sam is renamed to Mary Ruth (female, child, Team Eastwood)
-- ============================================================

UPDATE players SET handicap = 13.1, gender = 'M' WHERE name = 'John';
UPDATE players SET handicap = 14.2, gender = 'M' WHERE name = 'Martin';
UPDATE players SET handicap = 17.0, gender = 'M' WHERE name = 'Peter';
UPDATE players SET handicap = 14.6, gender = 'M' WHERE name = 'Paul';
UPDATE players SET handicap =  9.4, gender = 'M' WHERE name = 'Ross';
UPDATE players SET handicap =  5.4, gender = 'M' WHERE name = 'Matthew';
UPDATE players SET handicap =  3.0, gender = 'M' WHERE name = 'Dave';
UPDATE players SET handicap = 21.1, gender = 'F' WHERE name = 'Aisling';
UPDATE players SET handicap = 25.0, gender = 'F' WHERE name = 'Eithne';
UPDATE players SET handicap = 23.4, gender = 'F' WHERE name = 'Liz';
UPDATE players SET handicap = 22.9, gender = 'F' WHERE name = 'Gillian';
UPDATE players SET name = 'Mary Ruth', handicap = 18.9, gender = 'F' WHERE name = 'Sam';


-- ============================================================
-- STEP 2: Upsert playing handicaps for all 3 rounds
-- ============================================================

-- ----------------------------------------------------------
-- Round 1 — Old Tom Morris
-- Men: Blue  slope=123  CR=71.0  par=71
-- Women: Red slope=114  CR=70.5  par=71
--
-- PH = ROUND(HI × slope/113 + (CR − par))
--   John   13.1 × 1.0885 + 0.0 = 14.26 → 14
--   Martin 14.2 × 1.0885 + 0.0 = 15.46 → 15
--   Peter  17.0 × 1.0885 + 0.0 = 18.50 → 19
--   Paul   14.6 × 1.0885 + 0.0 = 15.89 → 16
--   Ross    9.4 × 1.0885 + 0.0 = 10.23 → 10
--   Matthew 5.4 × 1.0885 + 0.0 =  5.88 →  6
--   Dave    3.0 × 1.0885 + 0.0 =  3.27 →  3
--   Eithne    25.0 × 1.0089 − 0.5 = 24.72 → 25
--   Gillian   22.9 × 1.0089 − 0.5 = 22.60 → 23
--   Aisling   21.1 × 1.0089 − 0.5 = 20.79 → 21
--   Liz       23.4 × 1.0089 − 0.5 = 23.11 → 23
--   Mary Ruth 18.9 × 1.0089 − 0.5 = 18.57 → 19
-- ----------------------------------------------------------

INSERT INTO round_handicaps (round_id, player_id, playing_handicap) VALUES
  ('22222222-0000-0000-0000-000000000001', (SELECT id FROM players WHERE name = 'John'),      14),
  ('22222222-0000-0000-0000-000000000001', (SELECT id FROM players WHERE name = 'Martin'),    15),
  ('22222222-0000-0000-0000-000000000001', (SELECT id FROM players WHERE name = 'Peter'),     19),
  ('22222222-0000-0000-0000-000000000001', (SELECT id FROM players WHERE name = 'Paul'),      16),
  ('22222222-0000-0000-0000-000000000001', (SELECT id FROM players WHERE name = 'Ross'),      10),
  ('22222222-0000-0000-0000-000000000001', (SELECT id FROM players WHERE name = 'Matthew'),    6),
  ('22222222-0000-0000-0000-000000000001', (SELECT id FROM players WHERE name = 'Dave'),       3),
  ('22222222-0000-0000-0000-000000000001', (SELECT id FROM players WHERE name = 'Eithne'),    25),
  ('22222222-0000-0000-0000-000000000001', (SELECT id FROM players WHERE name = 'Gillian'),   23),
  ('22222222-0000-0000-0000-000000000001', (SELECT id FROM players WHERE name = 'Aisling'),   21),
  ('22222222-0000-0000-0000-000000000001', (SELECT id FROM players WHERE name = 'Liz'),       23),
  ('22222222-0000-0000-0000-000000000001', (SELECT id FROM players WHERE name = 'Mary Ruth'), 19)
ON CONFLICT (round_id, player_id) DO UPDATE SET playing_handicap = EXCLUDED.playing_handicap;

-- ----------------------------------------------------------
-- Round 2 — St Patrick's Links
-- Men: Slate  slope=125  CR=71.0  par=71
-- Women: Claret slope=119  CR=70.1  par=72
--
--   John   13.1 × 1.1062 + 0.0 = 14.49 → 14
--   Martin 14.2 × 1.1062 + 0.0 = 15.71 → 16
--   Peter  17.0 × 1.1062 + 0.0 = 18.81 → 19
--   Paul   14.6 × 1.1062 + 0.0 = 16.15 → 16
--   Ross    9.4 × 1.1062 + 0.0 = 10.40 → 10
--   Matthew 5.4 × 1.1062 + 0.0 =  5.97 →  6
--   Dave    3.0 × 1.1062 + 0.0 =  3.32 →  3
--   Eithne    25.0 × 1.0531 − 1.9 = 24.43 → 24
--   Gillian   22.9 × 1.0531 − 1.9 = 22.22 → 22
--   Aisling   21.1 × 1.0531 − 1.9 = 20.32 → 20
--   Liz       23.4 × 1.0531 − 1.9 = 22.74 → 23
--   Mary Ruth 18.9 × 1.0531 − 1.9 = 18.00 → 18
-- ----------------------------------------------------------

INSERT INTO round_handicaps (round_id, player_id, playing_handicap) VALUES
  ('22222222-0000-0000-0000-000000000002', (SELECT id FROM players WHERE name = 'John'),      14),
  ('22222222-0000-0000-0000-000000000002', (SELECT id FROM players WHERE name = 'Martin'),    16),
  ('22222222-0000-0000-0000-000000000002', (SELECT id FROM players WHERE name = 'Peter'),     19),
  ('22222222-0000-0000-0000-000000000002', (SELECT id FROM players WHERE name = 'Paul'),      16),
  ('22222222-0000-0000-0000-000000000002', (SELECT id FROM players WHERE name = 'Ross'),      10),
  ('22222222-0000-0000-0000-000000000002', (SELECT id FROM players WHERE name = 'Matthew'),    6),
  ('22222222-0000-0000-0000-000000000002', (SELECT id FROM players WHERE name = 'Dave'),       3),
  ('22222222-0000-0000-0000-000000000002', (SELECT id FROM players WHERE name = 'Eithne'),    24),
  ('22222222-0000-0000-0000-000000000002', (SELECT id FROM players WHERE name = 'Gillian'),   22),
  ('22222222-0000-0000-0000-000000000002', (SELECT id FROM players WHERE name = 'Aisling'),   20),
  ('22222222-0000-0000-0000-000000000002', (SELECT id FROM players WHERE name = 'Liz'),       23),
  ('22222222-0000-0000-0000-000000000002', (SELECT id FROM players WHERE name = 'Mary Ruth'), 18)
ON CONFLICT (round_id, player_id) DO UPDATE SET playing_handicap = EXCLUDED.playing_handicap;

-- ----------------------------------------------------------
-- Round 3 — Sandy Hills
-- Men: Blue slope=121  CR=71.0  par=72
-- Women: Red slope=119  CR=69.3  par=71
--
--   John   13.1 × 1.0708 − 1.0 = 13.03 → 13
--   Martin 14.2 × 1.0708 − 1.0 = 14.21 → 14
--   Peter  17.0 × 1.0708 − 1.0 = 17.20 → 17
--   Paul   14.6 × 1.0708 − 1.0 = 14.63 → 15
--   Ross    9.4 × 1.0708 − 1.0 =  9.07 →  9
--   Matthew 5.4 × 1.0708 − 1.0 =  4.78 →  5
--   Dave    3.0 × 1.0708 − 1.0 =  2.21 →  2
--   Eithne    25.0 × 1.0531 − 1.7 = 24.63 → 25
--   Gillian   22.9 × 1.0531 − 1.7 = 22.42 → 22
--   Aisling   21.1 × 1.0531 − 1.7 = 20.52 → 21
--   Liz       23.4 × 1.0531 − 1.7 = 22.94 → 23
--   Mary Ruth 18.9 × 1.0531 − 1.7 = 18.20 → 18
-- ----------------------------------------------------------

INSERT INTO round_handicaps (round_id, player_id, playing_handicap) VALUES
  ('22222222-0000-0000-0000-000000000003', (SELECT id FROM players WHERE name = 'John'),      13),
  ('22222222-0000-0000-0000-000000000003', (SELECT id FROM players WHERE name = 'Martin'),    14),
  ('22222222-0000-0000-0000-000000000003', (SELECT id FROM players WHERE name = 'Peter'),     17),
  ('22222222-0000-0000-0000-000000000003', (SELECT id FROM players WHERE name = 'Paul'),      15),
  ('22222222-0000-0000-0000-000000000003', (SELECT id FROM players WHERE name = 'Ross'),       9),
  ('22222222-0000-0000-0000-000000000003', (SELECT id FROM players WHERE name = 'Matthew'),    5),
  ('22222222-0000-0000-0000-000000000003', (SELECT id FROM players WHERE name = 'Dave'),       2),
  ('22222222-0000-0000-0000-000000000003', (SELECT id FROM players WHERE name = 'Eithne'),    25),
  ('22222222-0000-0000-0000-000000000003', (SELECT id FROM players WHERE name = 'Gillian'),   22),
  ('22222222-0000-0000-0000-000000000003', (SELECT id FROM players WHERE name = 'Aisling'),   21),
  ('22222222-0000-0000-0000-000000000003', (SELECT id FROM players WHERE name = 'Liz'),       23),
  ('22222222-0000-0000-0000-000000000003', (SELECT id FROM players WHERE name = 'Mary Ruth'), 18)
ON CONFLICT (round_id, player_id) DO UPDATE SET playing_handicap = EXCLUDED.playing_handicap;


-- ============================================================
-- STEP 3: Re-fire stableford trigger on all scored rounds
-- Recalculates stableford_points using updated round_handicaps
-- ============================================================

UPDATE scores SET gross_score = gross_score
WHERE round_id IN (
  '22222222-0000-0000-0000-000000000001',
  '22222222-0000-0000-0000-000000000002',
  '22222222-0000-0000-0000-000000000003'
);


-- ============================================================
-- STEP 4: Recalculate live_scores stableford_points (R1 only)
-- live_scores points are calculated in JS; this syncs the DB.
-- Split into male/female to apply correct SI/par.
-- ============================================================

-- Male players — use men's SI and par
UPDATE live_scores ls
SET stableford_points = GREATEST(0, h.par + 2 - (
  ls.gross_score - (
    FLOOR(rh.playing_handicap::numeric / 18)::int +
    CASE WHEN h.stroke_index <= (rh.playing_handicap % 18) THEN 1 ELSE 0 END
  )
))
FROM holes h, round_handicaps rh
WHERE h.course_id = '11111111-0000-0000-0000-000000000002'
  AND h.hole_number = ls.hole_number
  AND rh.round_id = '22222222-0000-0000-0000-000000000001'
  AND rh.player_id = ls.player_id
  AND ls.round_id = '22222222-0000-0000-0000-000000000001'
  AND ls.gross_score IS NOT NULL
  AND EXISTS (SELECT 1 FROM players WHERE id = ls.player_id AND gender = 'M');

-- Female players — use ladies SI and par where available
UPDATE live_scores ls
SET stableford_points = GREATEST(0,
  COALESCE(h.par_ladies, h.par) + 2 - (
    ls.gross_score - (
      FLOOR(rh.playing_handicap::numeric / 18)::int +
      CASE WHEN COALESCE(h.stroke_index_ladies, h.stroke_index) <= (rh.playing_handicap % 18) THEN 1 ELSE 0 END
    )
  )
)
FROM holes h, round_handicaps rh
WHERE h.course_id = '11111111-0000-0000-0000-000000000002'
  AND h.hole_number = ls.hole_number
  AND rh.round_id = '22222222-0000-0000-0000-000000000001'
  AND rh.player_id = ls.player_id
  AND ls.round_id = '22222222-0000-0000-0000-000000000001'
  AND ls.gross_score IS NOT NULL
  AND EXISTS (SELECT 1 FROM players WHERE id = ls.player_id AND gender = 'F');
