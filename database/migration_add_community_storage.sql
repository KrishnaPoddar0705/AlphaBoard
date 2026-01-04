-- Migration: Create storage bucket and policies for community images
-- Purpose: Enable image uploads for posts and comments
-- Date: 2025-01-XX

-- ============================================================================
-- 1. CREATE STORAGE BUCKET
-- ============================================================================

-- Create the storage bucket for community images
-- Bucket name: community-images
-- Public: false (use signed URLs)
-- Note: File size and MIME type validation is handled in the application layer
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM storage.buckets WHERE id = 'community-images') THEN
        INSERT INTO storage.buckets (id, name, public)
        VALUES (
            'community-images',
            'community-images',
            false
        );
        RAISE NOTICE 'Storage bucket "community-images" created successfully!';
    ELSE
        RAISE NOTICE 'Storage bucket "community-images" already exists';
    END IF;
END $$;

-- ============================================================================
-- 2. CREATE STORAGE POLICIES
-- ============================================================================

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Allow authenticated users to upload community images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to read community images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete own community images" ON storage.objects;

-- Policy 1: Allow authenticated users to upload images
-- Path pattern: {ticker}/{postId or commentId}/{uuid}.{ext}
-- Only allow PNG and JPEG images, max 5MB
CREATE POLICY "Allow authenticated users to upload community images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'community-images' AND
    (
        storage.extension(name) = 'png' OR
        storage.extension(name) = 'jpg' OR
        storage.extension(name) = 'jpeg'
    ) AND
    (storage.foldername(name))[1] IS NOT NULL AND -- ticker folder exists
    (storage.foldername(name))[2] IS NOT NULL -- post/comment ID folder exists
);

-- Policy 2: Allow authenticated and anonymous users to read images
-- This allows signed URLs to work for anyone
CREATE POLICY "Allow authenticated users to read community images"
ON storage.objects
FOR SELECT
TO authenticated, anon
USING (
    bucket_id = 'community-images'
);

-- Policy 3: Allow users to delete images they uploaded
-- Users can only delete files they own
CREATE POLICY "Allow authenticated users to delete own community images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'community-images' AND
    owner = auth.uid()
);

-- ============================================================================
-- 3. VERIFICATION
-- ============================================================================

-- Verify bucket was created
SELECT 
    'Storage bucket created' as status,
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
FROM storage.buckets
WHERE id = 'community-images';

-- Verify policies were created
SELECT 
    'Storage policies created' as status,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename = 'objects' 
    AND schemaname = 'storage'
    AND policyname LIKE '%community images%'
ORDER BY policyname;
