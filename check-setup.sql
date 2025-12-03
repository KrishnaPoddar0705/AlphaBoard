-- Quick check to see if research_reports setup is complete

-- Check if tables exist
SELECT 
  CASE 
    WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'research_reports') 
    THEN '✓ research_reports table exists'
    ELSE '✗ research_reports table missing - run migration'
  END as table_check;

SELECT 
  CASE 
    WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'report_queries') 
    THEN '✓ report_queries table exists'
    ELSE '✗ report_queries table missing - run migration'
  END as table_check;

-- Check if storage bucket exists
SELECT 
  CASE 
    WHEN EXISTS (SELECT FROM storage.buckets WHERE id = 'research-reports') 
    THEN '✓ research-reports bucket exists'
    ELSE '✗ research-reports bucket missing - create in dashboard'
  END as bucket_check;

