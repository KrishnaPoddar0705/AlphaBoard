-- Migration: Decouple recommendations from organizations
-- Purpose: Recommendations should follow the user's current organization (via profile)
-- not be permanently tied to an organization_id

-- 1. Make organization_id nullable in recommendations (it already is, but let's be explicit)
ALTER TABLE recommendations ALTER COLUMN organization_id DROP NOT NULL;

-- 2. Update RLS policy for recommendations SELECT to use profile's organization, not recommendation's
DROP POLICY IF EXISTS "Recommendations are viewable by everyone." ON recommendations;

CREATE POLICY "Recommendations are viewable by everyone."
ON recommendations FOR SELECT
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
  -- Public recommendations (user has no org or is not private)
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = recommendations.user_id
    AND (profiles.organization_id IS NULL OR profiles.is_private = false)
  )
);

-- 3. Update INSERT policy to not require organization_id match
DROP POLICY IF EXISTS "Users can create their own recommendations." ON recommendations;

CREATE POLICY "Users can create their own recommendations."
ON recommendations FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 4. Update UPDATE policy
DROP POLICY IF EXISTS "Users can update their own recommendations." ON recommendations;

CREATE POLICY "Users can update their own recommendations."
ON recommendations FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 5. Clear organization_id from all recommendations (optional - recommendations follow user now)
-- Uncomment if you want to fully decouple:
-- UPDATE recommendations SET organization_id = NULL;

-- Verify the policy
SELECT policyname, cmd, qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'recommendations'
ORDER BY cmd, policyname;

