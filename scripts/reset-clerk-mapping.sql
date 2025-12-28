-- Reset Clerk User Mapping SQL Script
-- 
-- Run this in your Supabase SQL editor to reset mappings for a specific email
-- Replace 'your-email@example.com' with your actual email address

-- 1. View all mappings for your email
SELECT 
    id,
    clerk_user_id,
    supabase_user_id,
    email,
    created_at,
    updated_at
FROM clerk_user_mapping
WHERE email = 'your-email@example.com';

-- 2. Delete all mappings for your email (uncomment to use)
-- DELETE FROM clerk_user_mapping
-- WHERE email = 'your-email@example.com';

-- 3. View all mappings to see what's in the database
-- SELECT * FROM clerk_user_mapping ORDER BY created_at DESC LIMIT 10;

-- 4. Find mappings for a specific Clerk user ID (if you know it)
-- SELECT * FROM clerk_user_mapping
-- WHERE clerk_user_id = 'user_xxxxxxxxxxxxx';

-- 5. Find mappings for a specific Supabase user ID
-- SELECT * FROM clerk_user_mapping
-- WHERE supabase_user_id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';

