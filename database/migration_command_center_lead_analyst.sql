-- Migration: Command Center -- lead analyst defaults to, and stays within the team of,
--            whoever added the stock
-- Purpose:
--   * A stock added to coverage is led by the person who added it unless they choose
--     otherwise -- no more "No lead analyst" on every new card.
--   * The lead can be changed to any analyst or portfolio manager who shares a team with
--     the person who added the stock (or back to that person). Coverage visibility
--     follows the lead (migration_command_center_coverage_scope.sql), so an unchecked
--     lead would quietly hand the name to another team.
-- Date: 2026-09-17
--
-- ORDERING: apply AFTER migration_command_center_home.sql (uses cc_shares_team).
--
-- BACKFILL: existing coverage with no lead is assigned to its creator. That is what the
-- default would have been; nothing else changes. Existing leads that break the new rule
-- are left as they are -- the check only runs when the lead is set or changed.
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS cc_coverage_25_lead ON public.cc_coverage;
--   DROP FUNCTION IF EXISTS public.cc_coverage_lead_rule();

CREATE OR REPLACE FUNCTION public.cc_coverage_lead_rule()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Default: whoever added it. created_by is stamped by cc_coverage_20_stamp, which
    -- runs first: BEFORE triggers fire in name order, and this one is numbered 25 to sit
    -- between the stamp (20) and the tenancy freeze (30). Asserted below.
    IF TG_OP = 'INSERT' AND NEW.lead_analyst_id IS NULL THEN
        NEW.lead_analyst_id := NEW.created_by;
    END IF;

    IF NEW.lead_analyst_id IS NOT NULL
       AND NEW.lead_analyst_id IS DISTINCT FROM NEW.created_by
       AND (TG_OP = 'INSERT' OR NEW.lead_analyst_id IS DISTINCT FROM OLD.lead_analyst_id)
    THEN
        IF NEW.organization_id IS NULL THEN
            RAISE EXCEPTION 'A personal (no organization) stock can only be led by its owner'
                USING ERRCODE = 'check_violation';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM public.user_organization_membership m
             WHERE m.user_id = NEW.lead_analyst_id
               AND m.organization_id = NEW.organization_id
               AND m.role IN ('analyst', 'portfolio_manager')
        ) OR NOT public.cc_shares_team(NEW.created_by, NEW.lead_analyst_id) THEN
            RAISE EXCEPTION 'The lead analyst must be an analyst or portfolio manager on the team of whoever added this stock'
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.cc_coverage_lead_rule() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS cc_coverage_25_lead ON public.cc_coverage;
CREATE TRIGGER cc_coverage_25_lead
    BEFORE INSERT OR UPDATE OF lead_analyst_id ON public.cc_coverage
    FOR EACH ROW EXECUTE FUNCTION public.cc_coverage_lead_rule();

-- The default depends on created_by already being stamped. BEFORE triggers on one table
-- fire alphabetically by name; fail loudly if the stamping trigger would run after us.
DO $order$
DECLARE
    stamp_name TEXT;
BEGIN
    SELECT t.tgname INTO stamp_name
      FROM pg_trigger t
      JOIN pg_proc p ON p.oid = t.tgfoid
     WHERE t.tgrelid = 'public.cc_coverage'::regclass
       AND p.proname = 'cc_stamp_owner'
       AND NOT t.tgisinternal
     LIMIT 1;
    IF stamp_name IS NULL THEN
        RAISE EXCEPTION 'cc_stamp_owner trigger not found on cc_coverage';
    END IF;
    IF stamp_name > 'cc_coverage_25_lead' THEN
        RAISE EXCEPTION 'Trigger % fires after cc_coverage_25_lead; rename one so created_by is stamped first', stamp_name;
    END IF;
END
$order$;

-- Backfill: unled coverage is led by whoever added it.
UPDATE public.cc_coverage SET lead_analyst_id = created_by WHERE lead_analyst_id IS NULL;

NOTIFY pgrst, 'reload schema';
