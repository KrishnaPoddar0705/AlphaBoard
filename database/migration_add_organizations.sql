-- Migration: Add multi-organization support with privacy controls
-- Purpose: Enable organizations, user memberships, and organization-scoped data
-- Date: 2025-01-XX

-- ============================================================================
-- 1. CREATE NEW TABLES
-- ============================================================================

-- Organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    join_code TEXT UNIQUE NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    settings JSONB DEFAULT '{}'::jsonb
);

-- User organization membership table (one org per user)
CREATE TABLE IF NOT EXISTS public.user_organization_membership (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    role TEXT CHECK (role IN ('admin', 'analyst')) NOT NULL DEFAULT 'analyst',
    joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT unique_user_membership UNIQUE (user_id)
);

-- ============================================================================
-- 2. ADD COLUMNS TO EXISTING TABLES
-- ============================================================================

-- Add organization_id and is_private to profiles
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE NOT NULL;

-- Add organization_id to recommendations
ALTER TABLE public.recommendations 
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Add organization_id to analyst_portfolio_weights
ALTER TABLE public.analyst_portfolio_weights 
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Add organization_id to price_targets (if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'price_targets') THEN
        ALTER TABLE public.price_targets 
            ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add organization_id to podcasts (if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'podcasts') THEN
        ALTER TABLE public.podcasts 
            ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================================
-- 3. CREATE INDEXES
-- ============================================================================

-- Organizations indexes
CREATE INDEX IF NOT EXISTS idx_organizations_join_code ON public.organizations(join_code);
CREATE INDEX IF NOT EXISTS idx_organizations_created_by ON public.organizations(created_by);

-- Membership indexes
CREATE INDEX IF NOT EXISTS idx_membership_user_id ON public.user_organization_membership(user_id);
CREATE INDEX IF NOT EXISTS idx_membership_organization_id ON public.user_organization_membership(organization_id);
CREATE INDEX IF NOT EXISTS idx_membership_role ON public.user_organization_membership(role);

-- Organization_id indexes on existing tables
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_organization_id ON public.recommendations(organization_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_weights_organization_id ON public.analyst_portfolio_weights(organization_id);

-- Conditional indexes for price_targets and podcasts
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'price_targets') THEN
        CREATE INDEX IF NOT EXISTS idx_price_targets_organization_id ON public.price_targets(organization_id);
    END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'podcasts') THEN
        CREATE INDEX IF NOT EXISTS idx_podcasts_organization_id ON public.podcasts(organization_id);
    END IF;
END $$;

-- ============================================================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_organization_membership ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. CREATE HELPER FUNCTIONS
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
-- 6. CREATE RLS POLICIES
-- ============================================================================

-- Organizations policies
DROP POLICY IF EXISTS "Users can view organizations they belong to" ON public.organizations;
CREATE POLICY "Users can view organizations they belong to"
    ON public.organizations FOR SELECT
    USING (
        -- Use security definer function to avoid infinite recursion
        public.user_belongs_to_org(auth.uid(), id)
    );

DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;
CREATE POLICY "Authenticated users can create organizations"
    ON public.organizations FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can update their organization" ON public.organizations;
CREATE POLICY "Admins can update their organization"
    ON public.organizations FOR UPDATE
    USING (public.is_org_admin(auth.uid(), id))
    WITH CHECK (public.is_org_admin(auth.uid(), id));

-- User organization membership policies
-- Use security definer function to avoid infinite recursion
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
        -- Users can insert their own membership as analyst
        user_id = auth.uid()
        AND role = 'analyst'
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

DROP POLICY IF EXISTS "Admins can remove members" ON public.user_organization_membership;
CREATE POLICY "Admins can remove members"
    ON public.user_organization_membership FOR DELETE
    USING (public.is_org_admin(auth.uid(), organization_id));

-- Profiles policies (update existing)
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

-- Recommendations policies (update existing)
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

-- Analyst portfolio weights policies (update existing)
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

-- Price targets policies (update if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'price_targets') THEN
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
    END IF;
END $$;

-- Podcasts policies (update if table exists)
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
-- 7. GRANT PERMISSIONS
-- ============================================================================

GRANT ALL ON public.organizations TO authenticated;
GRANT ALL ON public.user_organization_membership TO authenticated;
GRANT ALL ON public.organizations TO service_role;
GRANT ALL ON public.user_organization_membership TO service_role;

-- ============================================================================
-- 8. NOTIFY SUPABASE TO RELOAD SCHEMA
-- ============================================================================

NOTIFY pgrst, 'reload schema';

