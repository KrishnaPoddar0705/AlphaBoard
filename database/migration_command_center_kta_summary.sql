-- ============================================================================
-- Command Center: AI summaries of an entry's key takeaways
-- ============================================================================
--
-- Key takeaways can run to a page. When one is opened, the backend condenses it into
-- 3-4 bullets and caches them here, keyed by the entry and a hash of the text that was
-- summarised -- edit the takeaways and the next open regenerates.
--
-- A table of its own rather than columns on cc_events: writing to cc_events would bump
-- updated_at and rebuild search_tsv, so every summarised entry would look "changed" on
-- the home screen.
--
-- Only the backend (service role) reads or writes it. It checks the caller can see the
-- entry by reading cc_activity_feed with the caller's own token, under RLS, first. So
-- RLS is on with no policies: nothing reaches it through the anon or authenticated keys.
--
-- Safe to run more than once.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.cc_event_summaries (
    event_id     UUID PRIMARY KEY REFERENCES public.cc_events(id) ON DELETE CASCADE,
    source_hash  TEXT        NOT NULL,
    bullets      JSONB       NOT NULL,
    model        TEXT        NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cc_event_summaries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cc_event_summaries FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.cc_event_summaries TO service_role;

COMMENT ON TABLE public.cc_event_summaries IS
    'AI bullet summary of cc_events.kta, cached per entry; regenerated when the takeaways'' hash changes.';

COMMIT;

-- ============================================================================
-- Verify
-- ============================================================================
-- SELECT event_id, jsonb_array_length(bullets), model, created_at
--   FROM public.cc_event_summaries ORDER BY created_at DESC LIMIT 5;
-- ============================================================================
