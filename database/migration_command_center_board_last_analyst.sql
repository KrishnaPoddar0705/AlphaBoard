-- Migration: Command Center -- who logged the latest entry on each covered stock
-- Purpose: The coverage card shows "Last: <analyst> · 4d ago". cc_coverage_board already
--   has last_interaction_on; this adds whose entry that was.
-- Date: 2026-09-17
--
-- ORDERING: apply AFTER migration_command_center_home.sql (which last redefined this
-- view). The column list below is that definition with two columns appended -- new
-- columns go at the END, or CREATE OR REPLACE VIEW fails.
--
-- The view stays security_invoker, so "latest entry" is the latest entry THE CALLER can
-- see: a PM is never told the name of someone outside their teams.
--
-- ROLLBACK: re-run section 6 of migration_command_center_home.sql for cc_coverage_board.

CREATE OR REPLACE VIEW public.cc_coverage_board
WITH (security_invoker = true) AS
SELECT
    c.id,
    c.organization_id,
    c.created_by,
    c.ticker,
    c.company_name,
    c.market,
    c.understanding_level,
    c.model_status,
    c.corporate_address,
    c.sector,
    c.lead_analyst_id,
    c.notes,
    c.is_active,
    c.created_at,
    c.updated_at,
    pl.username                       AS lead_analyst_username,
    agg.last_interaction_on,
    CASE WHEN agg.last_interaction_on IS NULL THEN NULL
         ELSE (CURRENT_DATE - agg.last_interaction_on) END
                                      AS days_since_interaction,
    COALESCE(agg.event_count, 0)      AS event_count,
    COALESCE(agg.broker_report_count, 0) AS broker_report_count,
    cl.period_label                   AS latest_concall_period,
    cl.attendance                     AS latest_concall_attendance,
    ar.period_label                   AS latest_annual_report_period,
    ar.attendance                     AS latest_annual_report_attendance,
    nx.title                          AS next_scheduled_title,
    nx.event_date                     AS next_scheduled_on,
    cn.contact_count,
    agg.last_primary_research_on,
    -- Whose work the most recent logged entry is: the analyst it was logged for, else
    -- its author. Same rule as the home screen's ownerOf().
    le.owner_id                       AS last_entry_by,
    le.owner_username                 AS last_entry_by_username
  FROM public.cc_coverage c
  LEFT JOIN public.profiles pl ON pl.id = c.lead_analyst_id
  LEFT JOIN LATERAL (
      SELECT max(e.event_date) FILTER (
                 WHERE e.is_scheduled = FALSE AND e.event_date <= CURRENT_DATE
             )                                        AS last_interaction_on,
             count(*) FILTER (WHERE e.is_scheduled = FALSE) AS event_count,
             count(*) FILTER (WHERE e.kind = 'broker_report') AS broker_report_count,
             max(e.event_date) FILTER (
                 WHERE e.is_scheduled = FALSE AND e.event_date <= CURRENT_DATE
                   AND e.kind IN ('management_meeting', 'concall', 'agm')
             )                                        AS last_primary_research_on
        FROM public.cc_events e
       WHERE e.coverage_id = c.id
  ) agg ON TRUE
  LEFT JOIN LATERAL (
      SELECT e.period_label, e.attendance
        FROM public.cc_events e
       WHERE e.coverage_id = c.id AND e.kind = 'concall' AND e.is_scheduled = FALSE
       ORDER BY e.event_date DESC
       LIMIT 1
  ) cl ON TRUE
  LEFT JOIN LATERAL (
      SELECT e.period_label, e.attendance
        FROM public.cc_events e
       WHERE e.coverage_id = c.id AND e.kind = 'annual_report' AND e.is_scheduled = FALSE
       ORDER BY e.event_date DESC
       LIMIT 1
  ) ar ON TRUE
  LEFT JOIN LATERAL (
      SELECT e.title, e.event_date
        FROM public.cc_events e
       WHERE e.coverage_id = c.id AND e.is_scheduled = TRUE AND e.event_date >= CURRENT_DATE
       ORDER BY e.event_date ASC
       LIMIT 1
  ) nx ON TRUE
  LEFT JOIN LATERAL (
      SELECT count(*) AS contact_count
        FROM public.cc_contacts ct
       WHERE ct.coverage_id = c.id
  ) cn ON TRUE
  LEFT JOIN LATERAL (
      SELECT COALESCE(e.analyst_id, e.created_by) AS owner_id,
             p.username                           AS owner_username
        FROM public.cc_events e
        LEFT JOIN public.profiles p ON p.id = COALESCE(e.analyst_id, e.created_by)
       WHERE e.coverage_id = c.id AND e.is_scheduled = FALSE
       ORDER BY e.event_date DESC, e.created_at DESC
       LIMIT 1
  ) le ON TRUE;

REVOKE ALL ON public.cc_coverage_board FROM PUBLIC, anon;
GRANT SELECT ON public.cc_coverage_board TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
