-- ============================================================================
-- Command Center: opt-in escalation ("Push to PM" / "Push to Admin")
-- ============================================================================
--
-- Before this migration, every logged entry reached every reviewer automatically.
-- The client put anything <= 14 days old from a person you could review into your
-- "Awaiting your review" queue, and the only way off that list was to personally
-- endorse or reject it. On a working desk that is a queue nobody can finish, so the
-- signal in it -- the entry an analyst actually wants a verdict on -- was buried.
--
-- Escalation is now something the analyst does on purpose. Two independent targets:
-- an entry pushed to the PM does NOT appear in an admin's queue, and vice versa.
-- Routine logged work reaches nobody's queue at all; it is still fully visible in
-- the timeline, the stock page and the activity feed.
--
-- Safe to run more than once.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The two targets
-- ---------------------------------------------------------------------------

ALTER TABLE public.cc_events
    ADD COLUMN IF NOT EXISTS push_to_pm    BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS push_to_admin BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.cc_events.push_to_pm IS
    'Analyst pushed this entry to their portfolio manager for a verdict.';
COMMENT ON COLUMN public.cc_events.push_to_admin IS
    'Analyst pushed this entry to an org admin for a verdict. Independent of push_to_pm.';

-- Partial indexes matching idx_cc_events_review_requested: the queues read only the
-- pushed rows, which are a small minority of the table.
CREATE INDEX IF NOT EXISTS idx_cc_events_push_to_pm
    ON public.cc_events (organization_id, created_at DESC) WHERE push_to_pm;
CREATE INDEX IF NOT EXISTS idx_cc_events_push_to_admin
    ON public.cc_events (organization_id, created_at DESC) WHERE push_to_admin;

-- ---------------------------------------------------------------------------
-- 2. Backfill
-- ---------------------------------------------------------------------------
--
-- An existing "Ask my PM to review this" was exactly a push to the PM, so those
-- survive as PM pushes. Everything else was never an explicit request -- it only
-- appeared in a queue because the client put it there -- so it stays unpushed and
-- those queues go quiet immediately. Nothing is deleted.

UPDATE public.cc_events
   SET push_to_pm = TRUE
 WHERE review_requested
   AND NOT push_to_pm;

-- ---------------------------------------------------------------------------
-- 3. Keep review_requested in step
-- ---------------------------------------------------------------------------
--
-- review_requested stays as the derived "I escalated this and nobody has answered"
-- flag: the cc_activity_feed view already exposes it and the analyst-facing
-- "Waiting on your PM" group reads it. A trigger keeps it honest no matter which
-- client writes the row, so the two can never disagree.

CREATE OR REPLACE FUNCTION public.cc_sync_review_requested()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.review_requested := COALESCE(NEW.push_to_pm, FALSE)
                         OR COALESCE(NEW.push_to_admin, FALSE);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cc_events_sync_review_requested ON public.cc_events;
CREATE TRIGGER trg_cc_events_sync_review_requested
    BEFORE INSERT OR UPDATE OF push_to_pm, push_to_admin ON public.cc_events
    FOR EACH ROW EXECUTE FUNCTION public.cc_sync_review_requested();

-- ---------------------------------------------------------------------------
-- 4. Expose the targets on the feed the UI reads
-- ---------------------------------------------------------------------------
--
-- CREATE OR REPLACE VIEW can only APPEND columns -- it cannot reorder or drop one --
-- so this repeats migration_command_center_home.sql's column list verbatim (search_tsv
-- included) and adds the two push columns at the very end, per the convention noted
-- there: "new columns go at the END of each list".

CREATE OR REPLACE VIEW public.cc_activity_feed
WITH (security_invoker = true) AS
SELECT
    e.id                AS event_id,
    e.organization_id,
    e.coverage_id,
    cov.ticker,
    cov.company_name,
    cov.sector,
    cov.lead_analyst_id,
    e.kind,
    e.subtype,
    e.title,
    e.event_date,
    e.is_scheduled,
    e.attendance,
    e.period_label,
    e.thesis_impact,
    e.kta,
    e.open_questions,
    e.search_tsv,
    e.broker_id,
    b.name              AS broker_name,
    e.analyst_id,
    pa.username         AS analyst_username,
    e.created_by,
    pc.username         AS created_by_username,
    e.created_at,
    e.updated_at,
    (SELECT count(*) FROM public.cc_event_attachments a WHERE a.event_id = e.id)
                        AS attachment_count,
    (SELECT count(*) FROM public.cc_event_contacts ec WHERE ec.event_id = e.id)
                        AS contact_count,
    e.review_requested,
    e.review_note,
    (SELECT count(*) FROM public.cc_event_comments cm WHERE cm.event_id = e.id)
                        AS comment_count,
    e.push_to_pm,
    e.push_to_admin
  FROM public.cc_events   e
  JOIN public.cc_coverage cov ON cov.id = e.coverage_id
  LEFT JOIN public.profiles   pa ON pa.id = e.analyst_id
  LEFT JOIN public.profiles   pc ON pc.id = e.created_by
  LEFT JOIN public.cc_brokers b  ON b.id  = e.broker_id;

REVOKE ALL ON public.cc_activity_feed FROM PUBLIC, anon;
GRANT SELECT ON public.cc_activity_feed TO authenticated, service_role;

COMMIT;

-- ============================================================================
-- Verify
-- ============================================================================
-- SELECT count(*) FILTER (WHERE push_to_pm)    AS pushed_to_pm,
--        count(*) FILTER (WHERE push_to_admin) AS pushed_to_admin,
--        count(*) FILTER (WHERE review_requested) AS derived_flag,
--        count(*)                              AS total
--   FROM public.cc_events;
--
-- pushed_to_pm should equal the old review_requested count, and derived_flag
-- should equal pushed_to_pm + pushed_to_admin minus any pushed to both.
-- ============================================================================
