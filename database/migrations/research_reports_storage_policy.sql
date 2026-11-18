-- Let members read their organization's report PDFs (PDF preview / download).
-- Files live at {org_id}/{report_id}/{filename}.pdf, so the first folder is the org id.
-- Without a SELECT policy on storage.objects, createSignedUrl fails and the preview shows
-- "PDF not available". The hosted project got this policy through the dashboard; this file
-- is the same rule as code so a fresh database (the local stack) has it too.
-- Uploads and deletes go through the edge function (service role), so no write policy.
DROP POLICY IF EXISTS "research_reports_org_read" ON storage.objects;
CREATE POLICY "research_reports_org_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'research-reports'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM public.user_organization_membership WHERE user_id = auth.uid()
    )
  );
