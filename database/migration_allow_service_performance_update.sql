-- Migration: Allow service role to update performance table
-- Purpose: Enable backend to update cumulative_portfolio_return_pct and other performance metrics
-- Date: 2025-01-XX

-- Allow service role (backend) to insert performance records
CREATE POLICY IF NOT EXISTS "Service role can insert performance records."
  ON public.performance FOR INSERT
  WITH CHECK ( true );

-- Allow service role (backend) to update performance records
CREATE POLICY IF NOT EXISTS "Service role can update performance records."
  ON public.performance FOR UPDATE
  USING ( true )
  WITH CHECK ( true );



