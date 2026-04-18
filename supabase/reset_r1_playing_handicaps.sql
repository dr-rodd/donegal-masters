-- ============================================================
-- HARD RESET: Round 1 (Old Tom Morris) playing handicaps
-- Official values supplied directly — no formula applied.
-- ============================================================

UPDATE round_handicaps SET playing_handicap = 13 WHERE round_id = '22222222-0000-0000-0000-000000000001' AND player_id = (SELECT id FROM players WHERE name = 'John');
UPDATE round_handicaps SET playing_handicap = 15 WHERE round_id = '22222222-0000-0000-0000-000000000001' AND player_id = (SELECT id FROM players WHERE name = 'Martin');
UPDATE round_handicaps SET playing_handicap = 19 WHERE round_id = '22222222-0000-0000-0000-000000000001' AND player_id = (SELECT id FROM players WHERE name = 'Peter');
UPDATE round_handicaps SET playing_handicap = 16 WHERE round_id = '22222222-0000-0000-0000-000000000001' AND player_id = (SELECT id FROM players WHERE name = 'Paul');
UPDATE round_handicaps SET playing_handicap = 10 WHERE round_id = '22222222-0000-0000-0000-000000000001' AND player_id = (SELECT id FROM players WHERE name = 'Ross');
UPDATE round_handicaps SET playing_handicap =  6 WHERE round_id = '22222222-0000-0000-0000-000000000001' AND player_id = (SELECT id FROM players WHERE name = 'Matthew');
UPDATE round_handicaps SET playing_handicap =  3 WHERE round_id = '22222222-0000-0000-0000-000000000001' AND player_id = (SELECT id FROM players WHERE name = 'Dave');
UPDATE round_handicaps SET playing_handicap = 20 WHERE round_id = '22222222-0000-0000-0000-000000000001' AND player_id = (SELECT id FROM players WHERE name = 'Aisling');
UPDATE round_handicaps SET playing_handicap = 24 WHERE round_id = '22222222-0000-0000-0000-000000000001' AND player_id = (SELECT id FROM players WHERE name = 'Eithne');
UPDATE round_handicaps SET playing_handicap = 22 WHERE round_id = '22222222-0000-0000-0000-000000000001' AND player_id = (SELECT id FROM players WHERE name = 'Liz');
UPDATE round_handicaps SET playing_handicap = 18 WHERE round_id = '22222222-0000-0000-0000-000000000001' AND player_id = (SELECT id FROM players WHERE name = 'Mary Ruth');
UPDATE round_handicaps SET playing_handicap = 22 WHERE round_id = '22222222-0000-0000-0000-000000000001' AND player_id = (SELECT id FROM players WHERE name = 'Gillian');


-- ============================================================
-- Re-fire stableford trigger for Round 1
-- ============================================================

UPDATE scores SET gross_score = gross_score
WHERE round_id = '22222222-0000-0000-0000-000000000001';


-- ============================================================
-- Recalculate live_scores stableford_points for Round 1
-- Male players
-- ============================================================

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

-- Female players (use ladies SI/par where available)
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
