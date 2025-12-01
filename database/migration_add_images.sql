-- Add images column to recommendations table
ALTER TABLE public.recommendations
ADD COLUMN images text[];

-- Create a storage bucket for images if it doesn't exist (This usually needs to be done via Supabase Dashboard or Storage API, but this is the SQL representation of policies)
-- Note: You need to create a bucket named 'recommendation-images' in Supabase Storage.

-- Policy to allow public read access to recommendation images
-- create policy "Public Access"
--   on storage.objects for select
--   using ( bucket_id = 'recommendation-images' );

-- Policy to allow authenticated uploads
-- create policy "Authenticated Uploads"
--   on storage.objects for insert
--   with check ( bucket_id = 'recommendation-images' and auth.role() = 'authenticated' );

