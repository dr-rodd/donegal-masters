-- ============================================================
-- Fix unique constraints that were implicitly scoped to a single
-- tournament year, now that edition_year partitioning is in place.
--
-- Three constraints need edition_year added:
--
--   1. teams_name_key        (name)
--      → Same team names will be reused each year.
--        New constraint: (name, edition_year)
--
--   2. uq_rounds_number      (round_number)
--      → Round numbers 1/2/3 repeat every year.
--        New constraint: (round_number, edition_year)
--
--   3. uq_rounds_course      (course_id)
--      → Courses are not partitioned; same course UUIDs used each year.
--        New constraint: (course_id, edition_year)
--
-- FK check performed before writing this migration: no foreign key
-- anywhere in the schema references any of these three constraints,
-- so all DROPs are safe.
--
-- All other unique constraints on partitioned tables are already safe
-- because they are scoped via FK chains to other partitioned tables
-- (players, rounds, live_rounds), which produce new UUIDs each year.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- teams: (name) → (name, edition_year)
-- ------------------------------------------------------------
ALTER TABLE teams DROP CONSTRAINT teams_name_key;
ALTER TABLE teams ADD CONSTRAINT uq_teams_name_edition UNIQUE (name, edition_year);

-- ------------------------------------------------------------
-- rounds: (round_number) → (round_number, edition_year)
-- ------------------------------------------------------------
ALTER TABLE rounds DROP CONSTRAINT uq_rounds_number;
ALTER TABLE rounds ADD CONSTRAINT uq_rounds_number_edition UNIQUE (round_number, edition_year);

-- ------------------------------------------------------------
-- rounds: (course_id) → (course_id, edition_year)
-- ------------------------------------------------------------
ALTER TABLE rounds DROP CONSTRAINT uq_rounds_course;
ALTER TABLE rounds ADD CONSTRAINT uq_rounds_course_edition UNIQUE (course_id, edition_year);

COMMIT;
