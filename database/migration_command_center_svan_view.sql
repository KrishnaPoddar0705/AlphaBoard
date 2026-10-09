-- ============================================================================
-- Command Center: the "Svan View" on a logged entry
-- ============================================================================
--
-- Key takeaways record what the company said. The Svan View is what the desk's own
-- analyst makes of it: a short opinion, plus a five-step rating from strong sell to
-- strong buy that the UI colours from red to green.
--
-- Both are optional and independent of thesis_impact -- that says which way this one
-- entry moved the thesis; the rating says where the analyst now stands on the stock.
--
-- Safe to run more than once.
-- ============================================================================

BEGIN;

ALTER TABLE public.cc_events
    ADD COLUMN IF NOT EXISTS svan_view   TEXT,
    ADD COLUMN IF NOT EXISTS svan_rating TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'cc_events_svan_rating_check'
    ) THEN
        ALTER TABLE public.cc_events
            ADD CONSTRAINT cc_events_svan_rating_check
            CHECK (svan_rating IS NULL
                   OR svan_rating IN ('strong_sell', 'sell', 'neutral', 'buy', 'strong_buy'));
    END IF;
END $$;

COMMENT ON COLUMN public.cc_events.svan_view IS
    'The analyst''s own opinion on this entry, shown above the key takeaways.';
COMMENT ON COLUMN public.cc_events.svan_rating IS
    'Where the analyst stands after this entry: strong_sell | sell | neutral | buy | strong_buy.';

-- CREATE OR REPLACE VIEW can only APPEND columns, so this repeats
-- migration_command_center_push_targets.sql's column list verbatim and adds the two
-- new columns at the very end.

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
    e.push_to_admin,
    e.svan_view,
    e.svan_rating
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
-- SELECT svan_rating, count(*) FROM public.cc_events GROUP BY 1;
-- SELECT event_id, svan_view, svan_rating FROM public.cc_activity_feed LIMIT 1;
-- ============================================================================
