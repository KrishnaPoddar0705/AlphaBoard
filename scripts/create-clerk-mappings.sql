-- SQL Script: Create Clerk User Mappings from Migration
-- 
-- This script creates entries in clerk_user_mapping table based on the migration mappings file.
-- Run this after running the migrate-supabase-to-clerk.ts script.
--
-- Usage:
-- 1. Export the mappings from clerk-migration-mappings.json
-- 2. Update the INSERT statements below with your mappings
-- 3. Run this script in your Supabase SQL editor

-- Example: Insert mappings (update with your actual data)
-- You can generate these INSERT statements from the JSON file

INSERT INTO public.clerk_user_mapping (clerk_user_id, supabase_user_id, email)
VALUES
  -- Example format:
  -- ('user_xxx', 'supabase-uuid-here', 'user@example.com'),
  -- Add your mappings here
ON CONFLICT (clerk_user_id) DO UPDATE
SET 
  supabase_user_id = EXCLUDED.supabase_user_id,
  email = EXCLUDED.email,
  updated_at = NOW();

-- Or use a function to import from JSON:
-- This would require creating a function that reads from a JSON file
-- For now, manually insert the mappings or use a script

-- Verify mappings
SELECT 
  cm.clerk_user_id,
  cm.supabase_user_id,
  cm.email,
  au.email as supabase_email,
  p.username
FROM public.clerk_user_mapping cm
LEFT JOIN auth.users au ON au.id = cm.supabase_user_id
LEFT JOIN public.profiles p ON p.id = cm.supabase_user_id
ORDER BY cm.created_at DESC;

