-- Migration: Fix price_targets RLS policies to allow service role inserts
-- The backend uses service role key, but RLS policies need to allow inserts when user_id exists in profiles

-- Drop existing insert policy
DROP POLICY IF EXISTS "Users can insert their own price targets." ON public.price_targets;

-- Create new insert policy that allows service role (backend) to insert
-- This checks if user_id exists in profiles table, which validates the foreign key
CREATE POLICY "Service role or users can insert price targets."
  ON public.price_targets FOR INSERT
  WITH CHECK ( 
    -- Allow if user_id exists in profiles table (validates foreign key and allows service role)
    EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id)
    OR
    -- Also allow authenticated users to insert their own
    auth.uid() = user_id
  );

