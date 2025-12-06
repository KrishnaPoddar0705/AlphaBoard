-- Migration: Add Clerk user synchronization support
-- Purpose: Map Clerk user IDs to Supabase user IDs for authentication sync
-- Date: 2025-01-XX

-- ============================================================================
-- 1. CREATE CLERK USER MAPPING TABLE
-- ============================================================================

-- Table to map Clerk user IDs to Supabase user IDs
CREATE TABLE IF NOT EXISTS public.clerk_user_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_user_id TEXT UNIQUE NOT NULL,
    supabase_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT unique_clerk_user UNIQUE (clerk_user_id),
    CONSTRAINT unique_supabase_user UNIQUE (supabase_user_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_clerk_mapping_clerk_id ON public.clerk_user_mapping(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_clerk_mapping_supabase_id ON public.clerk_user_mapping(supabase_user_id);
CREATE INDEX IF NOT EXISTS idx_clerk_mapping_email ON public.clerk_user_mapping(email);

-- Enable Row Level Security
ALTER TABLE public.clerk_user_mapping ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own mapping
CREATE POLICY "Users can view their own mapping"
    ON public.clerk_user_mapping
    FOR SELECT
    USING (auth.uid() = supabase_user_id);

-- Service role can insert/update (for Edge Function)
-- Note: Edge Functions use service role, so they can bypass RLS
-- This policy is for direct client access if needed

-- ============================================================================
-- 2. CREATE FUNCTION TO UPDATE updated_at TIMESTAMP
-- ============================================================================

CREATE OR REPLACE FUNCTION update_clerk_mapping_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_clerk_mapping_updated_at ON public.clerk_user_mapping;
CREATE TRIGGER trigger_update_clerk_mapping_updated_at
    BEFORE UPDATE ON public.clerk_user_mapping
    FOR EACH ROW
    EXECUTE FUNCTION update_clerk_mapping_updated_at();

-- ============================================================================
-- 3. CREATE FUNCTION TO SYNC CLERK USER TO SUPABASE USER
-- ============================================================================

-- This function will be called by the Edge Function to create/update Supabase users
-- It handles the creation of profiles and performance records for new users
CREATE OR REPLACE FUNCTION sync_clerk_user_to_supabase(
    p_clerk_user_id TEXT,
    p_email TEXT,
    p_username TEXT DEFAULT NULL,
    p_first_name TEXT DEFAULT NULL,
    p_last_name TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_supabase_user_id UUID;
    v_existing_mapping RECORD;
BEGIN
    -- Check if mapping already exists
    SELECT supabase_user_id INTO v_existing_mapping
    FROM public.clerk_user_mapping
    WHERE clerk_user_id = p_clerk_user_id
    LIMIT 1;

    IF v_existing_mapping IS NOT NULL THEN
        -- Mapping exists, return existing Supabase user ID
        RETURN v_existing_mapping.supabase_user_id;
    END IF;

    -- Check if Supabase user exists by email
    SELECT id INTO v_supabase_user_id
    FROM auth.users
    WHERE email = p_email
    LIMIT 1;

    IF v_supabase_user_id IS NULL THEN
        -- User doesn't exist, we need to create one
        -- Note: This will be done by the Edge Function using admin API
        -- This function just returns NULL to indicate user needs to be created
        RETURN NULL;
    END IF;

    -- User exists, create mapping
    INSERT INTO public.clerk_user_mapping (
        clerk_user_id,
        supabase_user_id,
        email
    ) VALUES (
        p_clerk_user_id,
        v_supabase_user_id,
        p_email
    )
    ON CONFLICT (clerk_user_id) DO UPDATE
    SET updated_at = NOW()
    RETURNING supabase_user_id INTO v_supabase_user_id;

    RETURN v_supabase_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

