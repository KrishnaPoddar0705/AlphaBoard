-- Migration: Per-organization paper portfolio toggle
-- Purpose: Let an organization run AlphaBoard without share quantities, paper
--          trades or NAV. Beyond hiding the UI, this lets the frontend skip the
--          /api/portfolio reads, which price every open position through an
--          uncached yfinance lookup.
-- Date: 2026-09-06
--
-- ORDERING: apply this BEFORE deploying the frontend. useOrganization selects
-- organizations(id, name, paper_portfolio_enabled); against a database without
-- the column PostgREST rejects the whole select, so every user would read as
-- having no organization until the migration lands -- losing the org
-- leaderboard tab and admin dashboard, not just this flag.

ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS paper_portfolio_enabled BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.organizations.paper_portfolio_enabled IS
    'When false, hide share quantities, paper trades and NAV for this org''s users.';

-- Defaults to TRUE so every existing organization, and every user with no
-- organization, keeps today's behaviour. Opt an organization out with:
--
--   UPDATE public.organizations
--      SET paper_portfolio_enabled = FALSE
--    WHERE name = 'Svan Investments';
--
-- No RLS change is needed: the existing "Users can view organizations they
-- belong to" SELECT policy is row-level and already exposes every column of
-- the rows a user can see.
