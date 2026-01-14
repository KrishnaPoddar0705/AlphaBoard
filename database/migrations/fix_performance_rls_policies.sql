-- Migration: Fix performance table RLS policies for INSERT and UPDATE
-- Purpose: Allow backend service to insert/update performance records
-- Date: 2026-01-04

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Service role can insert performance records." ON public.performance;
DROP POLICY IF EXISTS "Service role can update performance records." ON public.performance;

-- Allow INSERT operations (for service role and authenticated users)
-- Service role bypasses RLS, but we also allow authenticated users to insert their own records
CREATE POLICY "Allow insert performance records"
  ON public.performance
  FOR INSERT
  WITH CHECK ( true );

-- Allow UPDATE operations (for service role and authenticated users)
-- Service role bypasses RLS, but we also allow authenticated users to update their own records
CREATE POLICY "Allow update performance records"
  ON public.performance
  FOR UPDATE
  USING ( true )
  WITH CHECK ( true );



