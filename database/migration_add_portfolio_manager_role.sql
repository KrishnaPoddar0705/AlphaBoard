-- Migration: Portfolio Manager role + per-recommendation team tagging
-- Purpose: Add a third organization role, 'portfolio_manager', that sits between
--          admin and analyst: full analyst rights, plus a read-only Team Dashboard
--          over the desks they belong to. Also gives recommendations an explicit,
--          editable, many-to-many team tag, so an idea can say which desk it was
--          written for instead of being inferred from its author's memberships.
-- Date: 2026-09-06
--
-- ORDERING: apply this BEFORE deploying the Edge Functions and the frontend.
-- set-recommendation-teams writes to recommendation_teams, and the Team Dashboard
-- reads it; against a database without the table every team save returns an error
-- and every Team Dashboard reads empty.
--
-- NOTE: `teams` and `team_members` have no checked-in DDL -- they were applied
-- directly in the Supabase console. This migration references them by foreign key
-- but deliberately does not try to create them; it will fail loudly on any
-- environment where they were never created, which is the correct outcome.
--
-- SCOPE: this migration deliberately does NOT tighten the recommendations SELECT
-- policy. Every organization member can still read every other member's
-- recommendations straight from the client. Team scoping is a PRESENTATION concern,
-- implemented in the UI and in get-visible-recommendations. recommendation_teams is
-- not a confidentiality boundary and must not be read as one.
--
-- INCOMPLETE ON ITS OWN: see migration_fix_profiles_role_check.sql. A trigger
-- created by hand in the console mirrors membership.role into profiles.role, whose
-- own CHECK also has to allow the new value. Widening only the constraint below
-- makes promotion fail with a profiles_role_check violation.
--
-- ROLLBACK is asymmetric. Re-adding the two-value CHECK fails while any row still
-- holds 'portfolio_manager', so the down path is:
--   UPDATE public.user_organization_membership
--      SET role = 'analyst' WHERE role = 'portfolio_manager';
--   -- then restore the old CHECK, then:
--   DROP TABLE public.recommendation_teams;
--   DROP FUNCTION public.team_org_id(UUID);

-- ---------------------------------------------------------------------------
-- 1. Widen the role constraint
-- ---------------------------------------------------------------------------
-- The CHECK in migration_add_organizations.sql was declared inline and unnamed, so
-- Postgres auto-named it <table>_<column>_check. Don't trust that name: parts of
-- this schema (teams, team_members, profiles.email) were applied by hand in the
-- Supabase console, so a second role CHECK under another name is plausible. Drop
-- every CHECK on this table that mentions the column.
DO $widen_role$
DECLARE c record;
BEGIN
    FOR c IN
        SELECT con.conname
          FROM pg_constraint con
          JOIN pg_class rel ON rel.oid = con.conrelid
          JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
         WHERE nsp.nspname = 'public'
           AND rel.relname = 'user_organization_membership'
           AND con.contype = 'c'
           AND pg_get_constraintdef(con.oid) ILIKE '%role%'
    LOOP
        EXECUTE format(
            'ALTER TABLE public.user_organization_membership DROP CONSTRAINT %I',
            c.conname);
    END LOOP;
END
$widen_role$;

ALTER TABLE public.user_organization_membership
    ADD CONSTRAINT user_organization_membership_role_check
    CHECK (role IN ('admin', 'analyst', 'portfolio_manager'));

COMMENT ON COLUMN public.user_organization_membership.role IS
    'admin = full org administration. portfolio_manager = analyst rights plus a '
    'read-only dashboard over the teams they belong to. analyst = own data only. '
    'A portfolio manager''s scope comes from team_members, not from this column.';

-- ---------------------------------------------------------------------------
-- 2. The membership INSERT policy (left as-is, on purpose)
-- ---------------------------------------------------------------------------
-- Deliberately NOT widened, and recreated only to record why.
--
-- This policy governs a user inserting their OWN membership row, which happens on
-- exactly two paths: creating an organization ('admin') and joining by code
-- ('analyst'). Nothing ever INSERTs a portfolio manager -- the role is granted by an
-- existing admin through update-member-role, which runs as service_role and bypasses
-- RLS entirely, and lands on the UPDATE policy's is_org_admin() check instead.
--
-- So adding 'portfolio_manager' here would buy nothing and cost something: the
-- predicate lets any org-less user self-insert into any organization_id, and
-- create-team has no role gate, so a third self-grantable role is a third way in.
DROP POLICY IF EXISTS "Users can join organization via join code" ON public.user_organization_membership;
CREATE POLICY "Users can join organization via join code"
    ON public.user_organization_membership FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND role IN ('analyst', 'admin')
        AND public.get_user_organization_id(auth.uid()) IS NULL
    );

-- is_org_admin() is deliberately NOT changed. It means "may administer this
-- organization", and a portfolio manager may not. ~8 RLS policies depend on that
-- meaning. No generalised has_org_role() helper is added either: team scoping is
-- enforced in the Edge Functions, so Postgres never needs to ask about the new role.

-- ---------------------------------------------------------------------------
-- 3. Per-recommendation team tags
-- ---------------------------------------------------------------------------

-- `teams` was created by hand in the console and its RLS is not described anywhere
-- in this repo. A policy that reads public.teams directly could therefore evaluate
-- to false for reasons nobody can see from the codebase. Read it through a
-- SECURITY DEFINER accessor instead, matching the is_org_admin /
-- get_user_organization_id pattern in migration_fix_rls_recursion.sql:43-85.
CREATE OR REPLACE FUNCTION public.team_org_id(team_uuid UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT org_id FROM public.teams WHERE id = team_uuid $$;

GRANT EXECUTE ON FUNCTION public.team_org_id(UUID) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.recommendation_teams (
    recommendation_id UUID NOT NULL
        REFERENCES public.recommendations(id) ON DELETE CASCADE,
    team_id UUID NOT NULL
        REFERENCES public.teams(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Composite PK makes a (rec, team) pair idempotent, so the backfill below and
    -- any replay of set-recommendation-teams are both safe to re-run.
    PRIMARY KEY (recommendation_id, team_id)
);

COMMENT ON TABLE public.recommendation_teams IS
    'Which desks a recommendation was written for. A recommendation with no rows '
    'here falls back, at read time, to every team its author currently belongs to.';

-- The PK already indexes (recommendation_id, team_id) left-to-right, which serves
-- "tags for this recommendation". The Team Dashboard asks the other question.
CREATE INDEX IF NOT EXISTS idx_recommendation_teams_team
    ON public.recommendation_teams(team_id);

ALTER TABLE public.recommendation_teams ENABLE ROW LEVEL SECURITY;

-- Visibility mirrors the parent recommendation exactly, so tagging grants nothing
-- that was not already readable. Team scoping is presentation-level by design.
DROP POLICY IF EXISTS "Recommendation teams follow the recommendation" ON public.recommendation_teams;
CREATE POLICY "Recommendation teams follow the recommendation"
    ON public.recommendation_teams FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.recommendations r
            WHERE r.id = recommendation_teams.recommendation_id
        )
    );

-- Writes are owner-only. The Edge Function additionally checks that each team is one
-- the author belongs to; that rule is not expressible here without a second lookup
-- policy, and keeping it in one place is what stops the two drifting apart.
DROP POLICY IF EXISTS "Owners can tag their recommendations" ON public.recommendation_teams;
CREATE POLICY "Owners can tag their recommendations"
    ON public.recommendation_teams FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.recommendations r
            WHERE r.id = recommendation_teams.recommendation_id
              AND r.user_id = auth.uid()
        )
        -- Backstop only. The narrower rule -- you may only tag teams you are a
        -- MEMBER of -- lives in the set-recommendation-teams Edge Function, because
        -- expressing it here would mean a second policy reading team_members and two
        -- copies of one rule that can drift. This clause is the cheap half: even if
        -- that function were bypassed, an author still cannot tag a team belonging
        -- to some other organization.
        AND public.user_belongs_to_org(
                auth.uid(),
                public.team_org_id(recommendation_teams.team_id))
    );

DROP POLICY IF EXISTS "Owners can untag their recommendations" ON public.recommendation_teams;
CREATE POLICY "Owners can untag their recommendations"
    ON public.recommendation_teams FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.recommendations r
            WHERE r.id = recommendation_teams.recommendation_id
              AND r.user_id = auth.uid()
        )
    );

GRANT ALL ON public.recommendation_teams TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Backfill
-- ---------------------------------------------------------------------------
-- One row per (existing recommendation x each team its author currently belongs to),
-- so a two-desk analyst's history lands on both Team Dashboards rather than
-- disappearing from all of them.
INSERT INTO public.recommendation_teams (recommendation_id, team_id)
SELECT r.id, tm.team_id
  FROM public.recommendations r
  JOIN public.team_members tm ON tm.user_id = r.user_id
ON CONFLICT DO NOTHING;

-- PostgREST caches the schema. Without this it can keep answering PGRST205
-- ("Could not find the table ... in the schema cache") for minutes after the DDL
-- lands, which looks exactly like the migration not having run.
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- 5. Verify
-- ---------------------------------------------------------------------------
-- Run these after applying. The two counts in the second block must match: every
-- recommendation whose author is on a team should now carry at least one tag.
--
--   SELECT role, count(*) FROM public.user_organization_membership GROUP BY 1;
--
--   SELECT
--     (SELECT count(DISTINCT recommendation_id) FROM public.recommendation_teams)
--       AS tagged_recommendations,
--     (SELECT count(*) FROM public.recommendations r
--       WHERE EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.user_id = r.user_id))
--       AS recommendations_by_teamed_authors;
--
-- Then confirm the new role is writable, without leaving a row behind:
--
--   BEGIN;
--     UPDATE public.user_organization_membership
--        SET role = 'portfolio_manager'
--      WHERE user_id = '<some-user-uuid>';
--   ROLLBACK;
