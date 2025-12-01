-- Migration: Add news articles table for stock news with GPT summaries

-- NEWS ARTICLES table
CREATE TABLE IF NOT EXISTS public.news_articles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  ticker TEXT NOT NULL,
  headline TEXT NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE NOT NULL,
  summary_tldr TEXT, -- 2-line summary from GPT
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  impact_score INTEGER CHECK (impact_score >= 0 AND impact_score <= 10),
  full_content TEXT,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for fast queries
CREATE INDEX idx_news_ticker ON public.news_articles(ticker);
CREATE INDEX idx_news_published_at ON public.news_articles(published_at DESC);
CREATE INDEX idx_news_ticker_published ON public.news_articles(ticker, published_at DESC);

-- Enable Row Level Security
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;

-- Policy: News articles are viewable by everyone
CREATE POLICY "News articles are viewable by everyone."
  ON public.news_articles FOR SELECT
  USING ( true );

-- Policy: Allow inserts for news articles (backend service can insert)
CREATE POLICY "News articles can be inserted by service role."
  ON public.news_articles FOR INSERT
  WITH CHECK ( true );

-- Policy: Allow updates for news articles (in case we need to update summaries)
CREATE POLICY "News articles can be updated by service role."
  ON public.news_articles FOR UPDATE
  USING ( true )
  WITH CHECK ( true );

-- Add unique constraint to prevent duplicate articles
CREATE UNIQUE INDEX idx_news_unique_article ON public.news_articles(ticker, source, headline, published_at);

