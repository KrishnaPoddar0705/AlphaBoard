-- Migration: Recreate price_targets RLS policies from scratch
-- Purpose: Allow all users to insert price targets, control visibility by organization

-- ============================================================================
-- 1. DROP ALL EXISTING POLICIES
-- ============================================================================

-- Drop all existing policies on price_targets
DROP POLICY IF EXISTS "Price targets are viewable by everyone." ON public.price_targets;
DROP POLICY IF EXISTS "Users can insert their own price targets." ON public.price_targets;
DROP POLICY IF EXISTS "Service role or users can insert price targets." ON public.price_targets;
DROP POLICY IF EXISTS "Users can insert price targets." ON public.price_targets;
DROP POLICY IF EXISTS "Allow price target inserts" ON public.price_targets;
DROP POLICY IF EXISTS "Allow all price target inserts" ON public.price_targets;

-- ============================================================================
-- 2. CREATE SIMPLE INSERT POLICY - ALLOW ALL INSERTS
-- ============================================================================

-- Allow all inserts - no restrictions
-- The backend uses service role key, but this also works for authenticated users
CREATE POLICY "Allow all price target inserts"
    ON public.price_targets FOR INSERT
    WITH CHECK (true);

-- ============================================================================
-- 3. CREATE SELECT POLICY - CONTROL VISIBILITY
-- ============================================================================

-- Users can see:
-- 1. Their own price targets
-- 2. Price targets in their organization (if they belong to one)
-- 3. Public price targets (no org, profile not private)
-- 4. Admins can see all price targets in their org
CREATE POLICY "Price targets visibility"
    ON public.price_targets FOR SELECT
    USING (
        -- User's own price targets
        user_id = auth.uid()
        OR
        -- Price targets in user's organization - using security definer function
        (
            organization_id IS NOT NULL
            AND public.user_belongs_to_org(auth.uid(), organization_id)
        )
        OR
        -- Public price targets (no org, profile not private)
        (
            organization_id IS NULL
            AND EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = price_targets.user_id
                AND is_private = FALSE
            )
        )
        OR
        -- Admins can see all price targets in their org - using security definer function
        (
            organization_id IS NOT NULL
            AND public.is_org_admin(auth.uid(), organization_id)
        )
    );

-- ============================================================================
-- 4. NO UPDATE OR DELETE POLICIES (price targets are immutable)
-- ============================================================================

-- Price targets are immutable once created, so no UPDATE or DELETE policies needed

