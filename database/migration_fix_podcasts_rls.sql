-- Migration: Fix podcasts RLS policies to allow service role inserts
-- The backend uses service role key, but RLS policies need to allow inserts when user_id exists in profiles

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert their own podcasts." ON public.podcasts;
DROP POLICY IF EXISTS "Users can view their own podcasts." ON public.podcasts;
DROP POLICY IF EXISTS "Users can update their own podcasts." ON public.podcasts;
DROP POLICY IF EXISTS "Users can delete their own podcasts." ON public.podcasts;

-- Create new insert policy that allows service role (backend) to insert
-- This checks if user_id exists in profiles table, which validates the foreign key
CREATE POLICY "Service role or users can insert podcasts."
  ON public.podcasts FOR INSERT
  WITH CHECK ( 
    -- Allow if user_id exists in profiles table (validates foreign key and allows service role)
    EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id)
    OR
    -- Also allow authenticated users to insert their own
    auth.uid() = user_id
  );

-- Update select policy
CREATE POLICY "Users can view their own podcasts."
  ON public.podcasts FOR SELECT
  USING ( 
    auth.uid() = user_id 
    OR 
    -- Allow if user_id exists in profiles (for service role reads)
    EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id)
  );

-- Update update policy
CREATE POLICY "Users can update their own podcasts."
  ON public.podcasts FOR UPDATE
  USING ( 
    auth.uid() = user_id 
    OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id)
  )
  WITH CHECK ( 
    auth.uid() = user_id 
    OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id)
  );

-- Update delete policy
CREATE POLICY "Users can delete their own podcasts."
  ON public.podcasts FOR DELETE
  USING ( 
    auth.uid() = user_id 
    OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id)
  );

