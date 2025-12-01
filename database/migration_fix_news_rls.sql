-- Migration: Fix RLS policies for news_articles table to allow inserts
-- Run this if you already have the news_articles table but can't insert

-- Drop existing policies if they exist (optional, will error if doesn't exist)
DROP POLICY IF EXISTS "News articles can be inserted by service role." ON public.news_articles;
DROP POLICY IF EXISTS "News articles can be updated by service role." ON public.news_articles;

-- Policy: Allow inserts for news articles (backend service can insert)
CREATE POLICY "News articles can be inserted by service role."
  ON public.news_articles FOR INSERT
  WITH CHECK ( true );

-- Policy: Allow updates for news articles (in case we need to update summaries)
CREATE POLICY "News articles can be updated by service role."
  ON public.news_articles FOR UPDATE
  USING ( true )
  WITH CHECK ( true );

