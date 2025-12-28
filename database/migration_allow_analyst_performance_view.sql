-- Migration: Allow viewing analyst performance data
-- Purpose: Update RLS policies to allow users to view recommendations and mappings for public analyst profiles
-- This enables the /analyst/:id/performance page to work correctly

-- ============================================================================
-- 1. UPDATE CLERK_USER_MAPPING RLS POLICY
-- ============================================================================

-- Allow users to view mappings for public profiles (needed for analyst performance pages)
DROP POLICY IF EXISTS "Users can view their own mapping" ON public.clerk_user_mapping;

CREATE POLICY "Users can view their own mapping"
    ON public.clerk_user_mapping
    FOR SELECT
    USING (
        -- Users can view their own mapping
        auth.uid() = supabase_user_id
        OR
        -- Users can view mappings for public profiles (for analyst performance pages)
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = clerk_user_mapping.supabase_user_id
            AND (profiles.is_private = FALSE OR profiles.organization_id IS NULL)
        )
        OR
        -- Users can view mappings for users in their organization
        EXISTS (
            SELECT 1 FROM public.profiles p1, public.profiles p2
            WHERE p1.id = auth.uid()
            AND p2.id = clerk_user_mapping.supabase_user_id
            AND p1.organization_id IS NOT NULL
            AND p1.organization_id = p2.organization_id
        )
    );

-- ============================================================================
-- 2. UPDATE RECOMMENDATIONS RLS POLICY
-- ============================================================================

-- Ensure recommendations are viewable for public analyst profiles (for performance pages)
DROP POLICY IF EXISTS "Recommendations are viewable by everyone." ON public.recommendations;

CREATE POLICY "Recommendations are viewable by everyone."
    ON public.recommendations FOR SELECT
    USING (
        -- Own recommendations
        user_id = auth.uid()
        OR
        -- Organization members can see each other's recommendations (based on user's CURRENT org)
        EXISTS (
            SELECT 1 FROM profiles p1, profiles p2
            WHERE p1.id = auth.uid()
            AND p2.id = recommendations.user_id
            AND p1.organization_id IS NOT NULL
            AND p1.organization_id = p2.organization_id
        )
        OR
        -- Admins can see recommendations of users in their organization
        EXISTS (
            SELECT 1 
            FROM user_organization_membership m1, profiles p2
            WHERE m1.user_id = auth.uid()
            AND m1.role = 'admin'
            AND p2.id = recommendations.user_id
            AND p2.organization_id = m1.organization_id
        )
        OR
        -- Public recommendations (user has no org OR profile is not private)
        -- This allows viewing any analyst's recommendations if their profile is public
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = recommendations.user_id
            AND (
                profiles.organization_id IS NULL 
                OR profiles.is_private = FALSE
            )
        )
    );

-- ============================================================================
-- 3. VERIFY POLICIES
-- ============================================================================

-- Verify clerk_user_mapping policy
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    cmd, 
    qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'clerk_user_mapping'
ORDER BY policyname;

-- Verify recommendations policy
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    cmd, 
    qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'recommendations'
ORDER BY policyname;

