-- Migration: Command Center -- team-scoped coverage
-- Purpose: A covered name is visible to the same people who can see work logged on it.
--   migration_command_center_home.sql scoped cc_events to teams but left cc_coverage
--   org-wide, so a portfolio manager saw cards for every stock the admin had added --
--   and could open none of the activity behind them. Coverage (and its contacts) now
--   follow the same rule as entries:
--     * org admin                          -> every name in the org
--     * whoever added it / its lead analyst -> that name
--     * anyone sharing a team with either   -> that name
--     * solo user                          -> their own names
-- Date: 2026-09-17
--
-- ORDERING: apply AFTER migration_command_center_home.sql (uses cc_shares_team).
--
-- TICKERS STAY UNIQUE PER ORG. If another team already covers a name, adding it again
-- is refused by the unique index even though the row is invisible to you; the RPC
-- below lets the client say so plainly instead of surfacing a bare 23505. An admin can
-- make you lead analyst on it, which brings it into your view.
--
-- ROLLBACK: re-run section 5b and 5e of migration_add_command_center.sql, then
--   DROP FUNCTION IF EXISTS public.cc_can_see_coverage(UUID,UUID,UUID,UUID),
--                           public.cc_coverage_taken(TEXT);

CREATE OR REPLACE FUNCTION public.cc_can_see_coverage(
    viewer UUID, org_id UUID, creator UUID, lead UUID
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
        WHEN viewer = creator OR viewer = lead THEN TRUE
        ELSE public.cc_shares_team(viewer, creator)
             OR (lead IS NOT NULL AND public.cc_shares_team(viewer, lead))
    END;
$$;

REVOKE ALL ON FUNCTION public.cc_can_see_coverage(UUID,UUID,UUID,UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cc_can_see_coverage(UUID,UUID,UUID,UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- cc_coverage
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Org members and solo owners can read coverage" ON public.cc_coverage;
DROP POLICY IF EXISTS "Team members and solo owners can read coverage" ON public.cc_coverage;
CREATE POLICY "Team members and solo owners can read coverage"
    ON public.cc_coverage FOR SELECT
    USING (public.cc_can_see_coverage(auth.uid(), organization_id, created_by, lead_analyst_id));

-- INSERT runs `.insert().select()`: the new row must be readable by its creator, which
-- the creator branch above guarantees. The INSERT policy itself is unchanged.

DROP POLICY IF EXISTS "Org members and solo owners can edit coverage" ON public.cc_coverage;
DROP POLICY IF EXISTS "Team members and solo owners can edit coverage" ON public.cc_coverage;
CREATE POLICY "Team members and solo owners can edit coverage"
    ON public.cc_coverage FOR UPDATE
    USING (public.cc_can_see_coverage(auth.uid(), organization_id, created_by, lead_analyst_id))
    WITH CHECK (
        (organization_id IS NOT NULL
            AND organization_id = public.get_user_organization_id(auth.uid()))
        OR (organization_id IS NULL AND created_by = auth.uid()
            AND public.get_user_organization_id(auth.uid()) IS NULL)
    );

-- ---------------------------------------------------------------------------
-- cc_contacts: visible when the stock they belong to is
-- ---------------------------------------------------------------------------
-- The EXISTS evaluates under cc_coverage's SELECT policy above.
DROP POLICY IF EXISTS "Org members and solo owners can read contacts" ON public.cc_contacts;
DROP POLICY IF EXISTS "Coverage viewers can read contacts" ON public.cc_contacts;
CREATE POLICY "Coverage viewers can read contacts"
    ON public.cc_contacts FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.cc_coverage cov WHERE cov.id = cc_contacts.coverage_id));

DROP POLICY IF EXISTS "Org members and solo owners can edit contacts" ON public.cc_contacts;
DROP POLICY IF EXISTS "Coverage viewers can edit contacts" ON public.cc_contacts;
CREATE POLICY "Coverage viewers can edit contacts"
    ON public.cc_contacts FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.cc_coverage cov WHERE cov.id = cc_contacts.coverage_id))
    WITH CHECK (
        (
            (organization_id IS NOT NULL
                AND organization_id = public.get_user_organization_id(auth.uid()))
            OR (organization_id IS NULL AND created_by = auth.uid()
                AND public.get_user_organization_id(auth.uid()) IS NULL)
        )
        AND EXISTS (SELECT 1 FROM public.cc_coverage cov WHERE cov.id = cc_contacts.coverage_id)
    );

-- ---------------------------------------------------------------------------
-- "Is this ticker already covered on my desk?" -- a yes/no, nothing more
-- ---------------------------------------------------------------------------
-- Returns only a boolean for the caller's own org: no id, no owner, no notes. Enough to
-- explain a refused add without handing out the row.
CREATE OR REPLACE FUNCTION public.cc_coverage_taken(p_ticker TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.cc_coverage c
         WHERE c.organization_id = public.get_user_organization_id(auth.uid())
           AND c.ticker = upper(btrim(p_ticker))
    );
$$;

REVOKE ALL ON FUNCTION public.cc_coverage_taken(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cc_coverage_taken(TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
