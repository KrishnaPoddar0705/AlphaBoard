-- Run this in Supabase SQL Editor to complete the research reports setup
-- Go to: https://supabase.com/dashboard/project/odfavebjfcwsovumrefx/editor

-- Check if tables already exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'research_reports') THEN
        RAISE NOTICE 'Creating research_reports table...';
        
        -- Create research_reports table
        CREATE TABLE public.research_reports (
          id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
          org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
          analyst_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
          title TEXT NOT NULL,
          original_filename TEXT NOT NULL,
          gemini_file_id TEXT,
          gemini_vector_store_id TEXT,
          sector TEXT,
          tickers TEXT[],
          parsed JSONB,
          storage_path TEXT NOT NULL,
          file_size_bytes INTEGER,
          upload_status TEXT CHECK (upload_status IN ('uploading', 'uploaded', 'indexing', 'indexed', 'parsing', 'parsed', 'failed')) DEFAULT 'uploading',
          error_message TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
        );

        -- Add indexes
        CREATE INDEX idx_research_reports_org_id ON public.research_reports(org_id);
        CREATE INDEX idx_research_reports_analyst_id ON public.research_reports(analyst_id);
        CREATE INDEX idx_research_reports_sector ON public.research_reports(sector);
        CREATE INDEX idx_research_reports_upload_status ON public.research_reports(upload_status);

        -- Enable RLS
        ALTER TABLE public.research_reports ENABLE ROW LEVEL SECURITY;

        -- RLS Policies
        CREATE POLICY "org_scoped_reports_select" ON public.research_reports
          FOR SELECT USING (
            org_id IN (SELECT organization_id FROM public.user_organization_membership WHERE user_id = auth.uid())
          );

        CREATE POLICY "org_scoped_reports_insert" ON public.research_reports
          FOR INSERT WITH CHECK (
            analyst_id = auth.uid() AND
            org_id IN (SELECT organization_id FROM public.user_organization_membership WHERE user_id = auth.uid())
          );

        RAISE NOTICE 'research_reports table created successfully!';
    ELSE
        RAISE NOTICE 'research_reports table already exists';
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'report_queries') THEN
        RAISE NOTICE 'Creating report_queries table...';
        
        -- Create report_queries table
        CREATE TABLE public.report_queries (
          id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
          org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
          analyst_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
          query_text TEXT NOT NULL,
          response_summary TEXT,
          response_full JSONB,
          report_ids_used UUID[],
          filters_applied JSONB,
          execution_time_ms INTEGER,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
        );

        -- Add indexes
        CREATE INDEX idx_report_queries_org_id ON public.report_queries(org_id);
        CREATE INDEX idx_report_queries_analyst_id ON public.report_queries(analyst_id);

        -- Enable RLS
        ALTER TABLE public.report_queries ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "org_scoped_queries_select" ON public.report_queries
          FOR SELECT USING (
            org_id IN (SELECT organization_id FROM public.user_organization_membership WHERE user_id = auth.uid())
          );

        CREATE POLICY "org_scoped_queries_insert" ON public.report_queries
          FOR INSERT WITH CHECK (
            analyst_id = auth.uid() AND
            org_id IN (SELECT organization_id FROM public.user_organization_membership WHERE user_id = auth.uid())
          );

        RAISE NOTICE 'report_queries table created successfully!';
    ELSE
        RAISE NOTICE 'report_queries table already exists';
    END IF;
END $$;

-- Check if storage bucket exists and create if needed
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM storage.buckets WHERE id = 'research-reports') THEN
        INSERT INTO storage.buckets (id, name, public)
        VALUES ('research-reports', 'research-reports', false);
        RAISE NOTICE 'Storage bucket created!';
    ELSE
        RAISE NOTICE 'Storage bucket already exists';
    END IF;
END $$;

-- Storage policies
DO $$
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Allow org members to upload reports" ON storage.objects;
    DROP POLICY IF EXISTS "Allow org members to read reports" ON storage.objects;
    DROP POLICY IF EXISTS "Allow analysts to update their own reports" ON storage.objects;
    DROP POLICY IF EXISTS "Allow analysts to delete their own reports" ON storage.objects;

    -- Create storage policies
    CREATE POLICY "Allow org members to upload reports"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'research-reports' AND
      (storage.foldername(name))[1] IN (
        SELECT organization_id::text FROM public.user_organization_membership WHERE user_id = auth.uid()
      )
    );

    CREATE POLICY "Allow org members to read reports"
    ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'research-reports' AND
      (storage.foldername(name))[1] IN (
        SELECT organization_id::text FROM public.user_organization_membership WHERE user_id = auth.uid()
      )
    );

    CREATE POLICY "Allow analysts to update their own reports"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'research-reports' AND owner = auth.uid());

    CREATE POLICY "Allow analysts to delete their own reports"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'research-reports' AND owner = auth.uid());

    RAISE NOTICE 'Storage policies created successfully!';
END $$;

-- Show summary
SELECT 
  'Setup Complete!' as status,
  (SELECT count(*) FROM information_schema.tables WHERE table_name IN ('research_reports', 'report_queries')) as tables_created,
  (SELECT count(*) FROM storage.buckets WHERE id = 'research-reports') as storage_buckets;

