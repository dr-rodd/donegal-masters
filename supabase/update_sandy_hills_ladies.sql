-- Sandy Hills ladies' Red tee data (from physical scorecard, April 2026)
-- Hole 1: par 4 for ladies (men's par 5 unchanged)
-- All other holes: same par as men but unique ladies stroke index

-- STEP 1: Update holes table
UPDATE holes SET stroke_index_ladies = 5,  par_ladies = 4 WHERE course_id = '11111111-0000-0000-0000-000000000001' AND hole_number = 1;
UPDATE holes SET stroke_index_ladies = 13, par_ladies = 4 WHERE course_id = '11111111-0000-0000-0000-000000000001' AND hole_number = 2;
UPDATE holes SET stroke_index_ladies = 7,  par_ladies = 3 WHERE course_id = '11111111-0000-0000-0000-000000000001' AND hole_number = 3;
UPDATE holes SET stroke_index_ladies = 11, par_ladies = 4 WHERE course_id = '11111111-0000-0000-0000-000000000001' AND hole_number = 4;
UPDATE holes SET stroke_index_ladies = 1,  par_ladies = 4 WHERE course_id = '11111111-0000-0000-0000-000000000001' AND hole_number = 5;
UPDATE holes SET stroke_index_ladies = 15, par_ladies = 4 WHERE course_id = '11111111-0000-0000-0000-000000000001' AND hole_number = 6;
UPDATE holes SET stroke_index_ladies = 17, par_ladies = 3 WHERE course_id = '11111111-0000-0000-0000-000000000001' AND hole_number = 7;
UPDATE holes SET stroke_index_ladies = 9,  par_ladies = 5 WHERE course_id = '11111111-0000-0000-0000-000000000001' AND hole_number = 8;
UPDATE holes SET stroke_index_ladies = 3,  par_ladies = 4 WHERE course_id = '11111111-0000-0000-0000-000000000001' AND hole_number = 9;
UPDATE holes SET stroke_index_ladies = 12, par_ladies = 4 WHERE course_id = '11111111-0000-0000-0000-000000000001' AND hole_number = 10;
UPDATE holes SET stroke_index_ladies = 10, par_ladies = 3 WHERE course_id = '11111111-0000-0000-0000-000000000001' AND hole_number = 11;
UPDATE holes SET stroke_index_ladies = 16, par_ladies = 4 WHERE course_id = '11111111-0000-0000-0000-000000000001' AND hole_number = 12;
UPDATE holes SET stroke_index_ladies = 2,  par_ladies = 5 WHERE course_id = '11111111-0000-0000-0000-000000000001' AND hole_number = 13;
UPDATE holes SET stroke_index_ladies = 18, par_ladies = 4 WHERE course_id = '11111111-0000-0000-0000-000000000001' AND hole_number = 14;
UPDATE holes SET stroke_index_ladies = 8,  par_ladies = 4 WHERE course_id = '11111111-0000-0000-0000-000000000001' AND hole_number = 15;
UPDATE holes SET stroke_index_ladies = 14, par_ladies = 3 WHERE course_id = '11111111-0000-0000-0000-000000000001' AND hole_number = 16;
UPDATE holes SET stroke_index_ladies = 4,  par_ladies = 5 WHERE course_id = '11111111-0000-0000-0000-000000000001' AND hole_number = 17;
UPDATE holes SET stroke_index_ladies = 6,  par_ladies = 4 WHERE course_id = '11111111-0000-0000-0000-000000000001' AND hole_number = 18;

-- STEP 2: Re-fire stableford trigger for any already-finalised Sandy Hills scores
-- (safe to run even if none exist yet)
UPDATE scores s
SET gross_score = gross_score
FROM holes h
JOIN rounds r ON r.course_id = h.course_id
JOIN players p ON p.id = s.player_id
WHERE s.hole_id = h.id
  AND s.round_id = r.id
  AND h.course_id = '11111111-0000-0000-0000-000000000001'
  AND p.gender = 'F';

-- STEP 3: Fix stableford_points in live_scores for in-progress female scores
-- (the trigger doesn't cover live_scores — those are client-calculated and need manual correction)
UPDATE live_scores ls
SET stableford_points = GREATEST(0,
  h.par_ladies + 2 - (
    ls.gross_score
    - FLOOR(rh.playing_handicap::numeric / 18)::int
    - CASE WHEN h.stroke_index_ladies <= (rh.playing_handicap % 18) THEN 1 ELSE 0 END
  )
)
FROM rounds r
JOIN holes h ON h.course_id = r.course_id AND h.hole_number = ls.hole_number
JOIN players p ON p.id = ls.player_id
JOIN round_handicaps rh ON rh.round_id = ls.round_id AND rh.player_id = ls.player_id
WHERE ls.round_id = r.id
  AND r.course_id = '11111111-0000-0000-0000-000000000001'
  AND p.gender = 'F'
  AND h.par_ladies IS NOT NULL
  AND h.stroke_index_ladies IS NOT NULL
  AND ls.gross_score IS NOT NULL;
