-- ============================================================================
-- Command Center: let the frontend read cached AI summaries directly
-- ============================================================================
--
-- Run after migration_command_center_kta_summary.sql.
--
-- Going through the backend for a cached summary cost three sequential round trips
-- (verify the token, check visibility, read the cache). Reading the table straight
-- from Supabase, like every other Command Center read, is one -- and the open entry
-- list fetches every cached summary in a single query.
--
-- A summary is visible exactly when its entry is: the policy's subquery on cc_events
-- runs under cc_events' own RLS for the caller. Writes stay service-role only.
--
-- Safe to run more than once.
-- ============================================================================

BEGIN;

GRANT SELECT ON public.cc_event_summaries TO authenticated;

DROP POLICY IF EXISTS cc_event_summaries_select ON public.cc_event_summaries;
CREATE POLICY cc_event_summaries_select ON public.cc_event_summaries
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.cc_events e WHERE e.id = cc_event_summaries.event_id));

COMMIT;

-- ============================================================================
-- Verify (as a signed-in user, via the app or the SQL editor's "run as" role)
-- ============================================================================
-- SELECT event_id, jsonb_array_length(bullets) FROM public.cc_event_summaries LIMIT 5;
-- ============================================================================
