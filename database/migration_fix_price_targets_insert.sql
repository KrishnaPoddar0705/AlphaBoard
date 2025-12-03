-- Migration: Fix price_targets INSERT policy to allow all inserts
-- Purpose: Allow all users to insert price targets
-- This is maximally permissive - allows all inserts

-- Drop ALL existing insert policies
DROP POLICY IF EXISTS "Users can insert their own price targets." ON public.price_targets;
DROP POLICY IF EXISTS "Service role or users can insert price targets." ON public.price_targets;
DROP POLICY IF EXISTS "Users can insert price targets." ON public.price_targets;
DROP POLICY IF EXISTS "Allow price target inserts" ON public.price_targets;

-- Create maximally permissive INSERT policy
-- Allows all inserts - visibility is controlled by SELECT policies
CREATE POLICY "Allow all price target inserts"
    ON public.price_targets FOR INSERT
    WITH CHECK (true);

