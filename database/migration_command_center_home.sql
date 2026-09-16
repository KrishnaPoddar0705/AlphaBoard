-- Migration: Command Center home -- team-scoped visibility, PM reviews, comments
-- Purpose: Turn the Command Center into the desk's home screen.
--   * Logs are no longer org-wide: an analyst sees their own entries and their team-mates';
--     a portfolio manager sees their team(s); an org admin sees everything.
--   * Portfolio managers (and admins) can ENDORSE / REJECT entries by their team.
--   * Anyone who can see an entry can comment on it.
--   * Analysts can ask their PM to review an entry (review_requested + review_note).
--   * cc_coverage_board gains last_primary_research_on for the "stale coverage" signal.
-- Date: 2026-09-17
--
-- ORDERING: apply AFTER migration_add_command_center.sql and
-- migration_add_portfolio_manager_role.sql.
--
-- TEAMS: `teams` (id, name, org_id) and `team_members` (team_id, user_id) were created in
-- the Supabase console and have no DDL in this repo. Everything below only READS them,
-- through SECURITY DEFINER helpers, so their own RLS does not matter here.
--
-- WHAT STAYS ORG-WIDE: cc_coverage (the list of names), cc_contacts, cc_brokers. A desk
-- shares one coverage universe; what each person learned about it is what gets scoped.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS public.cc_event_reviews, public.cc_event_comments CASCADE;
--   DROP FUNCTION IF EXISTS public.cc_my_teams(), public.cc_team_roster(UUID),
--       public.cc_derive_org_from_event();
--   -- Restore the SELECT/UPDATE policies on cc_events and the storage read policy from
--   -- migration_add_command_center.sql sections 5c and 9, THEN:
--   DROP FUNCTION IF EXISTS public.cc_can_see_event(UUID,UUID,UUID,UUID),
--       public.cc_can_review(UUID,UUID), public.cc_shares_team(UUID,UUID);
--   -- Re-run sections 7 and 10 of migration_add_command_center.sql for the views, then:
--   ALTER TABLE public.cc_events DROP COLUMN IF EXISTS review_requested,
--       DROP COLUMN IF EXISTS review_note;
--   NOTE: the rollback block in migration_add_command_center.sql lists
--   cc_search_events with 7 argument types; the function takes 8:
--   DROP FUNCTION IF EXISTS public.cc_search_events(TEXT,UUID,TEXT[],UUID,DATE,DATE,INT,INT);

-- ============================================================================
-- 1. VISIBILITY HELPERS
-- ============================================================================
-- SECURITY DEFINER so they can read team_members / membership regardless of those
-- tables' RLS, and so policies calling them cannot recurse. Each is a pure predicate over
-- its arguments: nothing here lets a caller enumerate rows.

CREATE OR REPLACE FUNCTION public.cc_shares_team(viewer UUID, subject UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT viewer IS NOT NULL AND subject IS NOT NULL AND EXISTS (
        SELECT 1
          FROM public.team_members a
          JOIN public.team_members b ON b.team_id = a.team_id
          JOIN public.teams t        ON t.id = a.team_id
         WHERE a.user_id = viewer
           AND b.user_id = subject
           AND t.org_id = public.get_user_organization_id(viewer)
    );
$$;

-- Admins review anything in their org; a PM reviews people they share a team with.
-- Nobody reviews their own entry (enforced in the policy, not here).
CREATE OR REPLACE FUNCTION public.cc_can_review(viewer UUID, subject UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
          FROM public.user_organization_membership m
         WHERE m.user_id = viewer
           AND (
                m.role = 'admin'
                AND m.organization_id = public.get_user_organization_id(subject)
             OR m.role = 'portfolio_manager'
                AND public.cc_shares_team(viewer, subject)
           )
    );
$$;

CREATE OR REPLACE FUNCTION public.cc_can_see_event(
    viewer UUID, org_id UUID, creator UUID, analyst UUID
)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE
        WHEN viewer IS NULL THEN FALSE
        WHEN org_id IS NULL THEN creator = viewer
        WHEN NOT public.user_belongs_to_org(viewer, org_id) THEN FALSE
        WHEN public.is_org_admin(viewer, org_id) THEN TRUE
        WHEN viewer = creator OR viewer = analyst THEN TRUE
        -- The entry belongs to whoever it is logged for; fall back to its author.
        ELSE public.cc_shares_team(viewer, COALESCE(analyst, creator))
             OR (analyst IS NOT NULL AND public.cc_shares_team(viewer, creator))
    END;
$$;

REVOKE ALL ON FUNCTION public.cc_shares_team(UUID,UUID)            FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cc_can_review(UUID,UUID)             FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cc_can_see_event(UUID,UUID,UUID,UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cc_shares_team(UUID,UUID)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.cc_can_review(UUID,UUID)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.cc_can_see_event(UUID,UUID,UUID,UUID) TO authenticated;

-- ============================================================================
-- 2. cc_events: review request columns + team-scoped SELECT / UPDATE
-- ============================================================================
ALTER TABLE public.cc_events
    ADD COLUMN IF NOT EXISTS review_requested BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS review_note TEXT;

CREATE INDEX IF NOT EXISTS idx_cc_events_review_requested
    ON public.cc_events (organization_id, created_at DESC)
    WHERE review_requested;

CREATE INDEX IF NOT EXISTS idx_cc_events_org_created
    ON public.cc_events (organization_id, created_at DESC);

DROP POLICY IF EXISTS "Org members and solo owners can read events" ON public.cc_events;
DROP POLICY IF EXISTS "Team members and solo owners can read events" ON public.cc_events;
CREATE POLICY "Team members and solo owners can read events"
    ON public.cc_events FOR SELECT
    USING (public.cc_can_see_event(auth.uid(), organization_id, created_by, analyst_id));

-- Editing follows reading: you cannot change what you cannot see. The WITH CHECK is the
-- original tenancy + parent-visibility rule, unchanged.
DROP POLICY IF EXISTS "Org members and solo owners can edit events" ON public.cc_events;
DROP POLICY IF EXISTS "Team members and solo owners can edit events" ON public.cc_events;
CREATE POLICY "Team members and solo owners can edit events"
    ON public.cc_events FOR UPDATE
    USING (public.cc_can_see_event(auth.uid(), organization_id, created_by, analyst_id))
    WITH CHECK (
        (
            (organization_id IS NOT NULL
                AND organization_id = public.get_user_organization_id(auth.uid()))
            OR (organization_id IS NULL AND created_by = auth.uid()
                AND public.get_user_organization_id(auth.uid()) IS NULL)
        )
        AND EXISTS (SELECT 1 FROM public.cc_coverage cov WHERE cov.id = cc_events.coverage_id)
        AND (broker_id IS NULL
             OR EXISTS (SELECT 1 FROM public.cc_brokers b WHERE b.id = cc_events.broker_id))
    );

-- cc_event_attachments and cc_event_contacts already gate on "parent event is visible"
-- through an EXISTS over cc_events, which evaluates under the policy above -- they are
-- team-scoped by this change with no edits of their own.

-- ============================================================================
-- 3. STORAGE: attachments follow their event
-- ============================================================================
-- The original read policy only checked the org folder, so any org member who knew (or
-- guessed) a path could mint a signed URL for another team's research. Paths are
--   {org}/{coverage}/{event}/{file}   or   user/{uid}/{coverage}/{event}/{file}
-- and files upload BEFORE the event row exists, so the uploader keeps access to their
-- own objects regardless.
DROP POLICY IF EXISTS "cc: read own org or own solo folder" ON storage.objects;
DROP POLICY IF EXISTS "cc: read attachments of visible events" ON storage.objects;
CREATE POLICY "cc: read attachments of visible events"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'command-center'
    AND (
        owner = auth.uid()
        OR (
            (storage.foldername(name))[1] = public.get_user_organization_id(auth.uid())::text
            AND EXISTS (
                SELECT 1 FROM public.cc_events e
                 WHERE e.id::text = (storage.foldername(name))[3]
            )
        )
        OR (
            (storage.foldername(name))[1] = 'user'
            AND (storage.foldername(name))[2] = auth.uid()::text
            AND public.get_user_organization_id(auth.uid()) IS NULL
        )
    )
);

-- ============================================================================
-- 4. REVIEWS AND COMMENTS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cc_derive_org_from_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    -- SECURITY INVOKER on purpose: the SELECT runs under cc_events RLS, so pointing at an
    -- invisible event yields NULL and the policy's visibility check rejects the row.
    SELECT e.organization_id INTO NEW.organization_id
      FROM public.cc_events e WHERE e.id = NEW.event_id;
    RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.cc_event_reviews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL REFERENCES public.cc_events(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    reviewer_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    verdict         TEXT NOT NULL CHECK (verdict IN ('endorse', 'reject')),
    note            TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT cc_event_reviews_one_per_reviewer UNIQUE (event_id, reviewer_id)
);
CREATE INDEX IF NOT EXISTS idx_cc_event_reviews_event ON public.cc_event_reviews (event_id);

CREATE TABLE IF NOT EXISTS public.cc_event_comments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL REFERENCES public.cc_events(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    author_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    body            TEXT NOT NULL CHECK (length(btrim(body)) > 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cc_event_comments_event
    ON public.cc_event_comments (event_id, created_at);

DROP TRIGGER IF EXISTS trg_cc_event_reviews_org ON public.cc_event_reviews;
CREATE TRIGGER trg_cc_event_reviews_org
    BEFORE INSERT ON public.cc_event_reviews
    FOR EACH ROW EXECUTE FUNCTION public.cc_derive_org_from_event();

DROP TRIGGER IF EXISTS trg_cc_event_comments_org ON public.cc_event_comments;
CREATE TRIGGER trg_cc_event_comments_org
    BEFORE INSERT ON public.cc_event_comments
    FOR EACH ROW EXECUTE FUNCTION public.cc_derive_org_from_event();

DROP TRIGGER IF EXISTS trg_cc_event_reviews_touch ON public.cc_event_reviews;
CREATE TRIGGER trg_cc_event_reviews_touch
    BEFORE UPDATE ON public.cc_event_reviews
    FOR EACH ROW EXECUTE FUNCTION public.cc_touch_updated_at();

DROP TRIGGER IF EXISTS trg_cc_event_comments_touch ON public.cc_event_comments;
CREATE TRIGGER trg_cc_event_comments_touch
    BEFORE UPDATE ON public.cc_event_comments
    FOR EACH ROW EXECUTE FUNCTION public.cc_touch_updated_at();

ALTER TABLE public.cc_event_reviews  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cc_event_comments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cc_event_reviews, public.cc_event_comments FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE
    ON public.cc_event_reviews, public.cc_event_comments TO authenticated;
GRANT ALL ON public.cc_event_reviews, public.cc_event_comments TO service_role;

-- --- reviews ---------------------------------------------------------------
DROP POLICY IF EXISTS "Read reviews on visible events" ON public.cc_event_reviews;
CREATE POLICY "Read reviews on visible events"
    ON public.cc_event_reviews FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.cc_events e WHERE e.id = cc_event_reviews.event_id));

-- The subject is whoever the entry is logged for (else its author). Reviewing your own
-- entry is refused even for an admin -- an endorsement has to come from someone else.
DROP POLICY IF EXISTS "Reviewers can endorse or reject team entries" ON public.cc_event_reviews;
CREATE POLICY "Reviewers can endorse or reject team entries"
    ON public.cc_event_reviews FOR INSERT
    WITH CHECK (
        reviewer_id = auth.uid()
        AND organization_id IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.cc_events e
             WHERE e.id = cc_event_reviews.event_id
               AND e.created_by <> auth.uid()
               AND COALESCE(e.analyst_id, e.created_by) <> auth.uid()
               AND public.cc_can_review(auth.uid(), COALESCE(e.analyst_id, e.created_by))
        )
    );

DROP POLICY IF EXISTS "Reviewers can change their verdict" ON public.cc_event_reviews;
CREATE POLICY "Reviewers can change their verdict"
    ON public.cc_event_reviews FOR UPDATE
    USING (reviewer_id = auth.uid())
    WITH CHECK (
        reviewer_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.cc_events e
             WHERE e.id = cc_event_reviews.event_id
               AND public.cc_can_review(auth.uid(), COALESCE(e.analyst_id, e.created_by))
        )
    );

DROP POLICY IF EXISTS "Reviewers can withdraw their verdict" ON public.cc_event_reviews;
CREATE POLICY "Reviewers can withdraw their verdict"
    ON public.cc_event_reviews FOR DELETE
    USING (reviewer_id = auth.uid());

-- Nothing but the verdict and note may change after the fact.
CREATE OR REPLACE FUNCTION public.cc_freeze_review_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.event_id <> OLD.event_id OR NEW.reviewer_id <> OLD.reviewer_id
       OR NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
        RAISE EXCEPTION 'A review cannot be moved to another entry or reviewer';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cc_event_reviews_freeze ON public.cc_event_reviews;
CREATE TRIGGER trg_cc_event_reviews_freeze
    BEFORE UPDATE ON public.cc_event_reviews
    FOR EACH ROW EXECUTE FUNCTION public.cc_freeze_review_identity();

-- --- comments --------------------------------------------------------------
DROP POLICY IF EXISTS "Read comments on visible events" ON public.cc_event_comments;
CREATE POLICY "Read comments on visible events"
    ON public.cc_event_comments FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.cc_events e WHERE e.id = cc_event_comments.event_id));

DROP POLICY IF EXISTS "Comment on visible events" ON public.cc_event_comments;
CREATE POLICY "Comment on visible events"
    ON public.cc_event_comments FOR INSERT
    WITH CHECK (
        author_id = auth.uid()
        AND EXISTS (SELECT 1 FROM public.cc_events e WHERE e.id = cc_event_comments.event_id)
    );

DROP POLICY IF EXISTS "Authors edit their comments" ON public.cc_event_comments;
CREATE POLICY "Authors edit their comments"
    ON public.cc_event_comments FOR UPDATE
    USING (author_id = auth.uid())
    WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "Authors and admins delete comments" ON public.cc_event_comments;
CREATE POLICY "Authors and admins delete comments"
    ON public.cc_event_comments FOR DELETE
    USING (
        author_id = auth.uid()
        OR (organization_id IS NOT NULL AND public.is_org_admin(auth.uid(), organization_id))
    );

-- ============================================================================
-- 5. TEAMS AND ROSTER FOR THE HOME SCREEN
-- ============================================================================
-- Admin: every team in the org. Everyone else: the teams they belong to.
CREATE OR REPLACE FUNCTION public.cc_my_teams()
RETURNS TABLE (id UUID, name TEXT, is_manager BOOLEAN, member_count INT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    WITH me AS (
        SELECT m.organization_id, m.role
          FROM public.user_organization_membership m
         WHERE m.user_id = auth.uid()
    )
    SELECT t.id, t.name::TEXT,
           (me.role = 'admin'
             OR (me.role = 'portfolio_manager' AND EXISTS (
                 SELECT 1 FROM public.team_members tm
                  WHERE tm.team_id = t.id AND tm.user_id = auth.uid()))) AS is_manager,
           (SELECT count(*)::INT FROM public.team_members tm WHERE tm.team_id = t.id)
      FROM public.teams t, me
     WHERE t.org_id = me.organization_id
       AND (me.role = 'admin' OR EXISTS (
            SELECT 1 FROM public.team_members tm
             WHERE tm.team_id = t.id AND tm.user_id = auth.uid()))
     ORDER BY t.name;
$$;

-- The people whose work the caller can see: everyone for an admin, otherwise the caller
-- plus their team-mates. p_team_id narrows to one team (which the caller must be able to
-- see -- an analyst passing another team's id gets nothing).
CREATE OR REPLACE FUNCTION public.cc_team_roster(p_team_id UUID DEFAULT NULL)
RETURNS TABLE (user_id UUID, username TEXT, role TEXT, team_ids UUID[])
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    WITH me AS (
        SELECT m.organization_id, m.role
          FROM public.user_organization_membership m
         WHERE m.user_id = auth.uid()
    ),
    visible_teams AS (
        SELECT t.id FROM public.teams t, me
         WHERE t.org_id = me.organization_id
           AND (me.role = 'admin' OR EXISTS (
                SELECT 1 FROM public.team_members tm
                 WHERE tm.team_id = t.id AND tm.user_id = auth.uid()))
           AND (p_team_id IS NULL OR t.id = p_team_id)
    )
    SELECT m.user_id, p.username::TEXT, m.role::TEXT,
           COALESCE(array_agg(DISTINCT tm.team_id) FILTER (WHERE tm.team_id IS NOT NULL),
                    '{}') AS team_ids
      FROM public.user_organization_membership m
      JOIN me ON me.organization_id = m.organization_id
      LEFT JOIN public.profiles p ON p.id = m.user_id
      LEFT JOIN public.team_members tm
             ON tm.user_id = m.user_id AND tm.team_id IN (SELECT id FROM visible_teams)
     WHERE
        CASE
          WHEN p_team_id IS NOT NULL THEN tm.team_id IS NOT NULL
          WHEN me.role = 'admin' THEN TRUE
          ELSE m.user_id = auth.uid() OR tm.team_id IS NOT NULL
        END
     GROUP BY m.user_id, p.username, m.role
     ORDER BY p.username;
$$;

REVOKE ALL ON FUNCTION public.cc_my_teams()          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cc_team_roster(UUID)   FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cc_my_teams()        TO authenticated;
GRANT EXECUTE ON FUNCTION public.cc_team_roster(UUID) TO authenticated;

-- ============================================================================
-- 6. VIEWS: append the new columns (new columns go at the END of each list)
-- ============================================================================
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
                        AS comment_count
  FROM public.cc_events   e
  JOIN public.cc_coverage cov ON cov.id = e.coverage_id
  LEFT JOIN public.profiles   pa ON pa.id = e.analyst_id
  LEFT JOIN public.profiles   pc ON pc.id = e.created_by
  LEFT JOIN public.cc_brokers b  ON b.id  = e.broker_id;

REVOKE ALL ON public.cc_activity_feed FROM PUBLIC, anon;
GRANT SELECT ON public.cc_activity_feed TO authenticated, service_role;

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
    -- Primary research = the desk talked to the company itself. Broker notes and annual
    -- reports are secondary and do not reset this clock.
    agg.last_primary_research_on
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
  ) cn ON TRUE;

REVOKE ALL ON public.cc_coverage_board FROM PUBLIC, anon;
GRANT SELECT ON public.cc_coverage_board TO authenticated, service_role;

-- ============================================================================
-- 7. RELOAD THE POSTGREST SCHEMA CACHE
-- ============================================================================
NOTIFY pgrst, 'reload schema';
