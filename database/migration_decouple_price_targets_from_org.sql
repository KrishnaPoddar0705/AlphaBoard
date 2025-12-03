-- Migration: Decouple price_targets from organizations
-- Purpose: Price targets should follow the user's current organization (via profile)
-- not be permanently tied to an organization_id

-- 1. Update RLS policies for price_targets
DROP POLICY IF EXISTS "Price targets are viewable by user and org admin" ON price_targets;
DROP POLICY IF EXISTS "Users can create their own price targets" ON price_targets;
DROP POLICY IF EXISTS "Allow all price target inserts" ON price_targets;
DROP POLICY IF EXISTS "Price targets visibility" ON price_targets;

-- SELECT policy: Based on user's current organization (via profile)
CREATE POLICY "Price targets are viewable by user and org admin"
ON price_targets FOR SELECT
USING (
  -- Own price targets
  user_id = auth.uid()
  OR
  -- Organization members can see each other's targets (based on current profile org)
  EXISTS (
    SELECT 1 FROM profiles p1, profiles p2
    WHERE p1.id = auth.uid()
    AND p2.id = price_targets.user_id
    AND p1.organization_id IS NOT NULL
    AND p1.organization_id = p2.organization_id
  )
  OR
  -- Admins can see targets of users in their organization
  EXISTS (
    SELECT 1 
    FROM user_organization_membership m1, profiles p2
    WHERE m1.user_id = auth.uid()
    AND m1.role = 'admin'
    AND p2.id = price_targets.user_id
    AND p2.organization_id = m1.organization_id
  )
  OR
  -- Public targets (user has no org or is not private)
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = price_targets.user_id
    AND (profiles.organization_id IS NULL OR profiles.is_private = false)
  )
);

-- INSERT policy: Users can create their own targets
CREATE POLICY "Users can create their own price targets"
ON price_targets FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 2. Clear organization_id from all price_targets (optional - they follow user now)
-- Uncomment if you want to fully decouple:
-- UPDATE price_targets SET organization_id = NULL;

