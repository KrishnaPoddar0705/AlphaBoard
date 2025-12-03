# Research Reports Storage Bucket Setup

## Create Storage Bucket

Run this SQL or use Supabase Dashboard:

```sql
-- Create the storage bucket for research reports
INSERT INTO storage.buckets (id, name, public)
VALUES ('research-reports', 'research-reports', false);
```

Or via Supabase CLI:
```bash
# This will be done via Dashboard at: https://supabase.com/dashboard/project/_/storage/buckets
```

## Storage Policies

Apply these RLS policies to the `research-reports` bucket:

### 1. Allow authenticated users to upload files to their org folder

```sql
CREATE POLICY "Allow org members to upload reports"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'research-reports' AND
  -- Path format: {org_id}/{report_id}/{filename}.pdf
  (storage.foldername(name))[1] IN (
    SELECT organization_id::text
    FROM public.user_organization_membership
    WHERE user_id = auth.uid()
  )
);
```

### 2. Allow org members to read files from their org folder

```sql
CREATE POLICY "Allow org members to read reports"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'research-reports' AND
  (storage.foldername(name))[1] IN (
    SELECT organization_id::text
    FROM public.user_organization_membership
    WHERE user_id = auth.uid()
  )
);
```

### 3. Allow users to update files they uploaded

```sql
CREATE POLICY "Allow analysts to update their own reports"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'research-reports' AND
  owner = auth.uid()
);
```

### 4. Allow users to delete files they uploaded

```sql
CREATE POLICY "Allow analysts to delete their own reports"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'research-reports' AND
  owner = auth.uid()
);
```

## Path Structure

All files should follow this structure:
```
research-reports/
  {org_id}/
    {report_id}/
      {original_filename}.pdf
```

Example:
```
research-reports/
  a1b2c3d4-e5f6-7890-abcd-ef1234567890/
    r9876543-210f-edcb-a098-765432109876/
      Goldman_Sachs_Metals_Report_Q4_2024.pdf
```

## MIME Type Restrictions

Configure bucket to only accept PDF files:
- Allowed MIME types: `application/pdf`
- Max file size: 50 MB (configurable)

## CORS Configuration

If needed for direct browser uploads:
```json
{
  "allowedOrigins": ["*"],
  "allowedMethods": ["GET", "POST", "PUT", "DELETE"],
  "allowedHeaders": ["*"],
  "maxAgeSeconds": 3600
}
```

