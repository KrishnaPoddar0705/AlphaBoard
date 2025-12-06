-- Migration: Add Clerk organization ID to organizations table
-- Purpose: Store Clerk organization ID for syncing with Clerk organizations
-- Date: 2025-01-XX

-- Add clerk_org_id column to organizations table
ALTER TABLE public.organizations 
    ADD COLUMN IF NOT EXISTS clerk_org_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_organizations_clerk_org_id 
    ON public.organizations(clerk_org_id);

-- Add comment
COMMENT ON COLUMN public.organizations.clerk_org_id IS 'Clerk organization ID for syncing with Clerk organizations';

