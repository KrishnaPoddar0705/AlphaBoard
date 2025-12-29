-- Secure function to get public leaderboard users
-- Returns only users who:
-- 1. Have public profiles (is_private = false)
-- 2. Are NOT members of any organization
-- This function runs server-side with proper security checks

CREATE OR REPLACE FUNCTION get_public_leaderboard_users()
RETURNS TABLE (
    id uuid,
    username text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Return users who are public and not in any organization
    -- Uses LEFT JOIN with IS NULL to find users not in user_organization_membership
    RETURN QUERY
    SELECT 
        p.id,
        p.username
    FROM profiles p
    LEFT JOIN user_organization_membership uom ON p.id = uom.user_id
    WHERE 
        p.is_private = false
        AND uom.user_id IS NULL  -- User is not in any organization
    ORDER BY p.username;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_public_leaderboard_users() TO authenticated;
GRANT EXECUTE ON FUNCTION get_public_leaderboard_users() TO anon;

-- Add comment for documentation
COMMENT ON FUNCTION get_public_leaderboard_users() IS 
'Returns public users who are not members of any organization. Used for public leaderboard display.';

