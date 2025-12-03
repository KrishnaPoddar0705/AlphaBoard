-- Migration: Fix infinite recursion in RLS policies
-- Purpose: Replace direct queries to user_organization_membership with security definer functions
-- Date: 2025-01-XX

-- ============================================================================
-- 1. DROP EXISTING POLICIES THAT DEPEND ON FUNCTIONS
-- ============================================================================

-- Drop policies that depend on functions first
DROP POLICY IF EXISTS "Admins can update their organization" ON public.organizations;
DROP POLICY IF EXISTS "Admins can update membership roles" ON public.user_organization_membership;
DROP POLICY IF EXISTS "Admins can remove members" ON public.user_organization_membership;
DROP POLICY IF EXISTS "Users can view memberships in their org" ON public.user_organization_membership;
DROP POLICY IF EXISTS "Users can join organization via join code" ON public.user_organization_membership;
DROP POLICY IF EXISTS "Users can view organizations they belong to" ON public.organizations;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Recommendations are viewable by everyone." ON public.recommendations;
DROP POLICY IF EXISTS "Users can view their own weights" ON public.analyst_portfolio_weights;

-- Drop price_targets policy if table exists
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'price_targets') THEN
        DROP POLICY IF EXISTS "Price targets are viewable by everyone." ON public.price_targets;
    END IF;
END $$;

-- Drop podcasts policy if table exists
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'podcasts') THEN
        DROP POLICY IF EXISTS "Users can view their own podcasts." ON public.podcasts;
    END IF;
END $$;

-- ============================================================================
-- 2. UPDATE HELPER FUNCTIONS WITH PROPER SECURITY SETTINGS
-- ============================================================================

-- Function to check if user is admin of an organization
-- SECURITY DEFINER bypasses RLS to prevent infinite recursion
CREATE OR REPLACE FUNCTION public.is_org_admin(user_uuid UUID, org_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_organization_membership
        WHERE user_id = user_uuid
        AND organization_id = org_uuid
        AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to get user's organization_id
-- SECURITY DEFINER bypasses RLS to prevent infinite recursion
CREATE OR REPLACE FUNCTION public.get_user_organization_id(user_uuid UUID)
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT organization_id FROM public.user_organization_membership
        WHERE user_id = user_uuid
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to check if user belongs to organization
-- SECURITY DEFINER bypasses RLS to prevent infinite recursion
CREATE OR REPLACE FUNCTION public.user_belongs_to_org(user_uuid UUID, org_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_organization_membership
        WHERE user_id = user_uuid
        AND organization_id = org_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 3. RECREATE RLS POLICIES TO USE SECURITY DEFINER FUNCTIONS
-- ============================================================================

-- Organizations policies
DROP POLICY IF EXISTS "Users can view organizations they belong to" ON public.organizations;
CREATE POLICY "Users can view organizations they belong to"
    ON public.organizations FOR SELECT
    USING (
        -- Use security definer function to avoid infinite recursion
        public.user_belongs_to_org(auth.uid(), id)
    );

-- Allow authenticated users to create organizations
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;
CREATE POLICY "Authenticated users can create organizations"
    ON public.organizations FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Allow admins to update their organization
DROP POLICY IF EXISTS "Admins can update their organization" ON public.organizations;
CREATE POLICY "Admins can update their organization"
    ON public.organizations FOR UPDATE
    USING (public.is_org_admin(auth.uid(), id))
    WITH CHECK (public.is_org_admin(auth.uid(), id));

-- User organization membership policies
DROP POLICY IF EXISTS "Users can view memberships in their org" ON public.user_organization_membership;
CREATE POLICY "Users can view memberships in their org"
    ON public.user_organization_membership FOR SELECT
    USING (
        -- Users can see their own membership
        user_id = auth.uid()
        OR
        -- Users can see memberships in their organization (using security definer function)
        public.user_belongs_to_org(auth.uid(), organization_id)
    );

DROP POLICY IF EXISTS "Users can join organization via join code" ON public.user_organization_membership;
CREATE POLICY "Users can join organization via join code"
    ON public.user_organization_membership FOR INSERT
    WITH CHECK (
        -- Users can insert their own membership
        user_id = auth.uid()
        -- Allow both analyst and admin roles (admin when creating org, analyst when joining)
        AND role IN ('analyst', 'admin')
        -- Check if user already has membership using security definer function
        AND public.get_user_organization_id(auth.uid()) IS NULL
    );

DROP POLICY IF EXISTS "Admins can update membership roles" ON public.user_organization_membership;
CREATE POLICY "Admins can update membership roles"
    ON public.user_organization_membership FOR UPDATE
    USING (
        -- Admins can update memberships in their organization
        public.is_org_admin(auth.uid(), organization_id)
    )
    WITH CHECK (
        -- Admins can update memberships in their organization
        public.is_org_admin(auth.uid(), organization_id)
    );

-- Profiles policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone."
    ON public.profiles FOR SELECT
    USING (
        -- Public profiles (not private)
        NOT is_private
        OR
        -- Own profile
        id = auth.uid()
        OR
        -- Org admins can see private profiles in their org (using security definer function)
        (
            is_private = TRUE
            AND organization_id IS NOT NULL
            AND public.is_org_admin(auth.uid(), organization_id)
        )
    );

-- Recommendations policies
DROP POLICY IF EXISTS "Recommendations are viewable by everyone." ON public.recommendations;
CREATE POLICY "Recommendations are viewable by everyone." ON public.recommendations FOR SELECT
    USING (
        -- User's own recommendations
        user_id = auth.uid()
        OR
        -- Recommendations in user's organization (if user has org) - using security definer function
        (
            organization_id IS NOT NULL
            AND public.user_belongs_to_org(auth.uid(), organization_id)
        )
        OR
        -- Public recommendations (no org, profile not private)
        (
            organization_id IS NULL
            AND EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = recommendations.user_id
                AND is_private = FALSE
            )
        )
        OR
        -- Admins can see all recommendations in their org - using security definer function
        (
            organization_id IS NOT NULL
            AND public.is_org_admin(auth.uid(), organization_id)
        )
    );

-- Analyst portfolio weights policies
DROP POLICY IF EXISTS "Users can view their own weights" ON public.analyst_portfolio_weights;
CREATE POLICY "Users can view their own weights"
    ON public.analyst_portfolio_weights FOR SELECT
    USING (
        -- User's own weights
        user_id = auth.uid()
        OR
        -- Weights in user's organization - using security definer function
        (
            organization_id IS NOT NULL
            AND public.user_belongs_to_org(auth.uid(), organization_id)
        )
        OR
        -- Public weights (no org, profile not private)
        (
            organization_id IS NULL
            AND EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = analyst_portfolio_weights.user_id
                AND is_private = FALSE
            )
        )
        OR
        -- Admins can see all weights in their org - using security definer function
        (
            organization_id IS NOT NULL
            AND public.is_org_admin(auth.uid(), organization_id)
        )
    );

-- Price targets policies (if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'price_targets') THEN
        -- SELECT policy
        DROP POLICY IF EXISTS "Price targets are viewable by everyone." ON public.price_targets;
        CREATE POLICY "Price targets are viewable by everyone." ON public.price_targets FOR SELECT
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

        -- INSERT policy - allow users to insert their own price targets
        DROP POLICY IF EXISTS "Users can insert their own price targets." ON public.price_targets;
        DROP POLICY IF EXISTS "Service role or users can insert price targets." ON public.price_targets;
        CREATE POLICY "Users can insert their own price targets."
            ON public.price_targets FOR INSERT
            WITH CHECK (
                -- Users can insert their own price targets
                user_id = auth.uid()
                AND (
                    -- If organization_id is provided, user must belong to that org
                    (
                        organization_id IS NOT NULL
                        AND public.user_belongs_to_org(auth.uid(), organization_id)
                    )
                    OR
                    -- If organization_id is null, user must not be in an org (or it's allowed)
                    (
                        organization_id IS NULL
                        OR public.get_user_organization_id(auth.uid()) IS NULL
                    )
                )
            );
    END IF;
END $$;

-- Podcasts policies (if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'podcasts') THEN
        DROP POLICY IF EXISTS "Users can view their own podcasts." ON public.podcasts;
        CREATE POLICY "Users can view their own podcasts."
            ON public.podcasts FOR SELECT
            USING (
                -- User's own podcasts
                user_id = auth.uid()
                OR
                -- Podcasts in user's organization - using security definer function
                (
                    organization_id IS NOT NULL
                    AND public.user_belongs_to_org(auth.uid(), organization_id)
                )
                OR
                -- Public podcasts (no org, profile not private)
                (
                    organization_id IS NULL
                    AND EXISTS (
                        SELECT 1 FROM public.profiles
                        WHERE id = podcasts.user_id
                        AND is_private = FALSE
                    )
                )
                OR
                -- Admins can see all podcasts in their org - using security definer function
                (
                    organization_id IS NOT NULL
                    AND public.is_org_admin(auth.uid(), organization_id)
                )
            );
    END IF;
END $$;

-- ============================================================================
-- 3. NOTIFY SUPABASE TO RELOAD SCHEMA
-- ============================================================================

NOTIFY pgrst, 'reload schema';

