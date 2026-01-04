-- Migration: Enhance RAG System with Query Rewrite, Multi-Query, Reranking, and Caching
-- Purpose: Add production-grade RAG patterns for consistent, evidence-grounded answers

-- =====================================================
-- ENHANCE report_queries TABLE
-- =====================================================

-- Add new columns to track enhanced RAG pipeline metadata
ALTER TABLE public.report_queries 
  ADD COLUMN IF NOT EXISTS query_object JSONB,
  ADD COLUMN IF NOT EXISTS subqueries TEXT[],
  ADD COLUMN IF NOT EXISTS retrieved_count INT,
  ADD COLUMN IF NOT EXISTS reranked_count INT,
  ADD COLUMN IF NOT EXISTS retrieval_debug JSONB;

-- Add comment for documentation
COMMENT ON COLUMN public.report_queries.query_object IS 'Structured query rewrite output with intent, entities, subqueries, etc.';
COMMENT ON COLUMN public.report_queries.subqueries IS 'Array of subqueries executed in multi-query retrieval';
COMMENT ON COLUMN public.report_queries.retrieved_count IS 'Number of chunks retrieved from multi-query search';
COMMENT ON COLUMN public.report_queries.reranked_count IS 'Number of chunks after reranking';
COMMENT ON COLUMN public.report_queries.retrieval_debug IS 'Debug metadata for retrieval pipeline';

-- =====================================================
-- CREATE rag_query_cache TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.rag_query_cache (
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  question_hash TEXT NOT NULL,
  answer_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  expires_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) + INTERVAL '10 minutes' NOT NULL,
  PRIMARY KEY (org_id, question_hash)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_rag_cache_expires ON public.rag_query_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_rag_cache_org_id ON public.rag_query_cache(org_id);

-- Enable RLS
ALTER TABLE public.rag_query_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can access cache for their organization
CREATE POLICY "org_scoped_cache_select" 
  ON public.rag_query_cache
  FOR SELECT
  USING (
    org_id IN (
      SELECT organization_id 
      FROM public.user_organization_membership 
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: System can insert/update cache (via service role)
-- Note: Edge Functions use service role, so this is handled server-side
-- No INSERT policy needed as Edge Functions bypass RLS with service role

-- Add comment
COMMENT ON TABLE public.rag_query_cache IS 'Cache for RAG query responses with 10-minute TTL';

-- =====================================================
-- CLEANUP FUNCTION (Optional - for expired cache cleanup)
-- =====================================================

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION public.cleanup_expired_rag_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM public.rag_query_cache
  WHERE expires_at < timezone('utc'::text, now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.cleanup_expired_rag_cache IS 'Cleans up expired cache entries. Can be called via cron job.';

