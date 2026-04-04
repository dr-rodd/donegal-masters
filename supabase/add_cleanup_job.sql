-- ============================================================
-- STALE LIVE DATA CLEANUP JOB
-- Runs hourly via pg_cron (enabled by default in Supabase).
--
-- live_scores: deletes uncommitted rows for sessions where the
--   most recent hole submission is older than 2 hours. Groups by
--   (player_id, round_id) so all holes in an abandoned session are
--   removed together rather than partially.
--
-- live_rounds: closes active sessions where no live_scores have
--   been submitted in the past 2 hours AND the session started at
--   least 2 hours ago. The live_scores activity check ensures a
--   legitimate in-progress round (last hole entered <2h ago) is
--   never accidentally closed even if the session has been running
--   for longer than 2 hours.
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

-- Schedule: run at the top of every hour
-- To verify: SELECT * FROM cron.job;
-- To remove: SELECT cron.unschedule('cleanup-stale-live-data');
SELECT cron.schedule(
  'cleanup-stale-live-data',
  '0 * * * *',
  'SELECT public.cleanup_stale_live_data()'
);
