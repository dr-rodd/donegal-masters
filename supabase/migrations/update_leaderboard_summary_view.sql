-- ============================================================
-- Update leaderboard views to expose edition_year.
--
-- Now that the underlying tables (rounds, scores, players, teams)
-- carry edition_year, the views must JOIN that column through so
-- callers can filter with .eq("edition_year", currentYear) rather
-- than returning mixed-year data.
--
-- edition_year is taken from rounds (the natural year-scoping table
-- in the scoring hierarchy). All other tables in the joins are
-- consistently stamped with the same year by application code.
-- ============================================================

-- leaderboard_by_round depends on leaderboard_summary via the second
-- view, so drop the summary first (it references by_round), then
-- recreate both in the correct order.

DROP VIEW IF EXISTS leaderboard_summary;
DROP VIEW IF EXISTS leaderboard_by_round;

CREATE OR REPLACE VIEW leaderboard_by_round AS
WITH ranked AS (
  SELECT
    r.id           AS round_id,
    r.round_number,
    r.edition_year,
    c.name         AS course_name,
    t.id           AS team_id,
    t.name         AS team_name,
    t.color        AS team_color,
    h.hole_number,
    h.par,
    s.stableford_points,
    ROW_NUMBER() OVER (
      PARTITION BY r.id, t.id, h.hole_number
      ORDER BY s.stableford_points DESC
    ) AS rn
  FROM scores s
  JOIN players p ON p.id = s.player_id
  JOIN teams   t ON t.id = p.team_id
  JOIN holes   h ON h.id = s.hole_id
  JOIN rounds  r ON r.id = s.round_id
  JOIN courses c ON c.id = r.course_id
  WHERE NOT p.is_composite
),
top2 AS (
  SELECT
    round_id, round_number, edition_year, course_name,
    team_id, team_name, team_color,
    hole_number, par,
    SUM(stableford_points) AS best_stableford_points
  FROM ranked
  WHERE rn <= 2
  GROUP BY
    round_id, round_number, edition_year, course_name,
    team_id, team_name, team_color,
    hole_number, par
)
SELECT
  *,
  SUM(best_stableford_points) OVER (
    PARTITION BY round_id, team_id
    ORDER BY hole_number
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS running_team_total
FROM top2
ORDER BY round_number, hole_number, team_name;


CREATE OR REPLACE VIEW leaderboard_summary AS
SELECT
  round_id,
  round_number,
  edition_year,
  course_name,
  team_id,
  team_name,
  team_color,
  SUM(best_stableford_points) AS total_team_points,
  COUNT(hole_number)          AS holes_completed
FROM leaderboard_by_round
GROUP BY
  round_id, round_number, edition_year, course_name,
  team_id, team_name, team_color
ORDER BY
  round_number,
  total_team_points DESC;
