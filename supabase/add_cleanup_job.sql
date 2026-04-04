-- ============================================================
-- STALE LIVE DATA CLEANUP FUNCTION
-- Called by the Next.js API route /api/cleanup (see app/api/cleanup/route.ts).
-- If pg_cron is ever enabled, uncomment the cron.schedule block below
-- to run it directly from the database instead.
--
-- live_scores: deletes uncommitted rows for sessions where the
--   most recent hole submission is older than 2 hours. Groups by
--   (player_id, round_id) so all holes in an abandoned session are
--   removed together rather than partially.
--
-- live_rounds: closes active sessions with no live_scores activity
--   in the past 2h AND activated >2h ago, so legitimate long rounds
--   are never accidentally closed mid-play.
-- ============================================================

CREATE OR REPLACE FUNCTION public.cleanup_stale_live_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Remove uncommitted scores for abandoned sessions
  DELETE FROM public.live_scores
  WHERE committed = false
    AND (player_id, round_id) IN (
      SELECT player_id, round_id
      FROM   public.live_scores
      WHERE  committed = false
      GROUP  BY player_id, round_id
      HAVING max(submitted_at) < now() - interval '2 hours'
    );

  -- Close active live_rounds with no recent scoring activity
  UPDATE public.live_rounds
  SET    status    = 'closed',
         closed_at = now()
  WHERE  status       = 'active'
    AND  activated_at < now() - interval '2 hours'
    AND  NOT EXISTS (
           SELECT 1
           FROM   public.live_scores
           WHERE  round_id     = live_rounds.round_id
             AND  submitted_at > now() - interval '2 hours'
         );
END;
$$;

-- Uncomment if pg_cron is enabled (Database > Extensions in Supabase dashboard):
-- SELECT cron.schedule(
--   'cleanup-stale-live-data',
--   '0 * * * *',
--   'SELECT public.cleanup_stale_live_data()'
-- );
