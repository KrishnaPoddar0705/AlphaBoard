-- Migration: allow 'portfolio_manager' in profiles.role
-- Purpose: Promoting a member to portfolio manager failed with
--            new row for relation "profiles" violates check constraint
--            "profiles_role_check"
--          even though update-member-role only ever writes to
--          user_organization_membership.
-- Date: 2026-09-06
--
-- WHY THIS IS NEEDED, and why migration_add_portfolio_manager_role.sql missed it:
--
-- There are two independent `role` columns in this schema:
--   user_organization_membership.role -- what the whole application reads
--   profiles.role                     -- read by no application code at all
--
-- profiles.role looks dead from the repo, and that is exactly the trap: a trigger
-- created directly in the Supabase console (like teams, team_members and
-- profiles.email, none of which have checked-in DDL) mirrors a membership role
-- change into profiles.role. So an UPDATE that names only the membership table
-- still lands a write on profiles, and fails its CHECK.
--
-- schema.sql:8 declares that CHECK as (role IN ('analyst','manager')). Promoting to
-- 'admin' works in production today, so the live constraint has already drifted from
-- the repo -- it must have been widened by hand at some point. This migration
-- therefore does not assume the current definition; it drops whatever role CHECK
-- exists and installs the full union.
--
-- SAFETY: this only ever widens. Every value previously accepted is still accepted,
-- so it cannot fail against existing rows and cannot invalidate stored data.
-- 'manager' is kept because legacy rows may still hold it -- dropping it would turn
-- this into a narrowing change and could fail on live data.

DO $widen_profiles_role$
DECLARE c record;
BEGIN
    FOR c IN
        SELECT con.conname
          FROM pg_constraint con
          JOIN pg_class rel ON rel.oid = con.conrelid
          JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
         WHERE nsp.nspname = 'public'
           AND rel.relname = 'profiles'
           AND con.contype = 'c'
           AND pg_get_constraintdef(con.oid) ILIKE '%role%'
    LOOP
        EXECUTE format(
            'ALTER TABLE public.profiles DROP CONSTRAINT %I', c.conname);
    END LOOP;
END
$widen_profiles_role$;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IS NULL OR role IN ('analyst', 'manager', 'admin', 'portfolio_manager'));

COMMENT ON COLUMN public.profiles.role IS
    'Mirror of user_organization_membership.role, maintained by a database trigger. '
    'No application code reads this column -- read the membership table instead. It '
    'exists here only so that whatever writes it does not fail, and its CHECK must '
    'be widened alongside the membership one whenever a role is added.';

NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Diagnostics (optional -- run these to see what is actually mirroring the role)
-- ---------------------------------------------------------------------------
--   SELECT conname, pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conrelid = 'public.profiles'::regclass AND contype = 'c';
--
--   SELECT tgname, pg_get_triggerdef(oid)
--     FROM pg_trigger
--    WHERE tgrelid = 'public.user_organization_membership'::regclass
--      AND NOT tgisinternal;
--
--   SELECT role, count(*) FROM public.profiles GROUP BY 1;
