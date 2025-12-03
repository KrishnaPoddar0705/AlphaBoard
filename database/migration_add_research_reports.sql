-- Migration: Add Research Reports and Institutional Memory tables
-- Purpose: Enable RAPID RAG research intelligence layer

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLE: research_reports
-- Stores uploaded research PDFs with parsed data
-- =====================================================
CREATE TABLE public.research_reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  analyst_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  gemini_file_id TEXT, -- Google Gemini File API ID
  gemini_vector_store_id TEXT, -- Vector store ID for RAG
  sector TEXT,
  tickers TEXT[], -- Array of ticker symbols mentioned in report
  parsed JSONB, -- Structured extracted data from report
  storage_path TEXT NOT NULL, -- Supabase Storage path
  file_size_bytes INTEGER,
  upload_status TEXT CHECK (upload_status IN ('uploading', 'uploaded', 'indexing', 'indexed', 'parsing', 'parsed', 'failed')) DEFAULT 'uploading',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add indexes for performance
CREATE INDEX idx_research_reports_org_id ON public.research_reports(org_id);
CREATE INDEX idx_research_reports_analyst_id ON public.research_reports(analyst_id);
CREATE INDEX idx_research_reports_sector ON public.research_reports(sector);
CREATE INDEX idx_research_reports_tickers ON public.research_reports USING GIN(tickers);
CREATE INDEX idx_research_reports_created_at ON public.research_reports(created_at DESC);
CREATE INDEX idx_research_reports_upload_status ON public.research_reports(upload_status);

-- Enable RLS
ALTER TABLE public.research_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Analysts can view reports in their organization
CREATE POLICY "org_scoped_reports_select" 
  ON public.research_reports
  FOR SELECT
  USING (
    org_id IN (
      SELECT organization_id 
      FROM public.user_organization_membership 
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Analysts can insert reports for their organization
CREATE POLICY "org_scoped_reports_insert" 
  ON public.research_reports
  FOR INSERT
  WITH CHECK (
    analyst_id = auth.uid() AND
    org_id IN (
      SELECT organization_id 
      FROM public.user_organization_membership 
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Analysts can update their own reports
CREATE POLICY "org_scoped_reports_update" 
  ON public.research_reports
  FOR UPDATE
  USING (
    analyst_id = auth.uid() AND
    org_id IN (
      SELECT organization_id 
      FROM public.user_organization_membership 
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Analysts can delete their own reports
CREATE POLICY "org_scoped_reports_delete" 
  ON public.research_reports
  FOR DELETE
  USING (
    analyst_id = auth.uid() AND
    org_id IN (
      SELECT organization_id 
      FROM public.user_organization_membership 
      WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- TABLE: report_queries
-- Track RAG queries for analytics and history
-- =====================================================
CREATE TABLE public.report_queries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  analyst_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  query_text TEXT NOT NULL,
  response_summary TEXT,
  response_full JSONB, -- Full response with citations
  report_ids_used UUID[], -- Array of report IDs that were relevant
  filters_applied JSONB, -- Store filter parameters used
  execution_time_ms INTEGER, -- Query performance tracking
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add indexes
CREATE INDEX idx_report_queries_org_id ON public.report_queries(org_id);
CREATE INDEX idx_report_queries_analyst_id ON public.report_queries(analyst_id);
CREATE INDEX idx_report_queries_created_at ON public.report_queries(created_at DESC);
CREATE INDEX idx_report_queries_report_ids ON public.report_queries USING GIN(report_ids_used);

-- Enable RLS
ALTER TABLE public.report_queries ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Analysts can view queries in their organization
CREATE POLICY "org_scoped_queries_select" 
  ON public.report_queries
  FOR SELECT
  USING (
    org_id IN (
      SELECT organization_id 
      FROM public.user_organization_membership 
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Analysts can insert queries for their organization
CREATE POLICY "org_scoped_queries_insert" 
  ON public.report_queries
  FOR INSERT
  WITH CHECK (
    analyst_id = auth.uid() AND
    org_id IN (
      SELECT organization_id 
      FROM public.user_organization_membership 
      WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- FUNCTION: Update updated_at timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_research_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating updated_at
CREATE TRIGGER research_reports_updated_at
  BEFORE UPDATE ON public.research_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_research_reports_updated_at();

-- =====================================================
-- STORAGE BUCKET POLICIES
-- Note: Bucket must be created via Supabase Dashboard or CLI
-- Bucket name: research-reports
-- Path structure: {org_id}/{report_id}/{filename}.pdf
-- =====================================================

-- These policies will be applied via Supabase Dashboard/CLI:
-- 1. INSERT policy: Allow authenticated users to upload to their org folder
-- 2. SELECT policy: Allow users to read files from their org folder
-- 3. UPDATE policy: Allow users to update files they uploaded
-- 4. DELETE policy: Allow users to delete files they uploaded

COMMENT ON TABLE public.research_reports IS 'Stores metadata and parsed content for uploaded research reports';
COMMENT ON TABLE public.report_queries IS 'Tracks RAG queries and responses for analytics';
COMMENT ON COLUMN public.research_reports.parsed IS 'JSONB containing structured extracted data: sector_outlook, key_drivers, company_ratings, valuation_summary, risks, catalysts, charts_and_tables, price_forecasts, regulatory_changes, financial_tables, summary_sentence, one_paragraph_thesis, insights, actionables, citations';
COMMENT ON COLUMN public.research_reports.gemini_file_id IS 'Google Gemini File API identifier for vector search';

