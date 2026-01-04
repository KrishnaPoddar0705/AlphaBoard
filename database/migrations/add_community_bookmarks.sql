-- Migration: Add community bookmarks table
-- Purpose: Allow users to bookmark stocks in the community feed
-- Date: 2025-01-27

-- ============================================================================
-- 1. CREATE COMMUNITY_BOOKMARKS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.community_bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- Supabase auth user ID (from auth.uid())
    ticker TEXT NOT NULL,
    region TEXT NOT NULL DEFAULT 'USA',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(user_id, ticker, region) -- One bookmark per user per ticker per region
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_community_bookmarks_user ON public.community_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_community_bookmarks_ticker ON public.community_bookmarks(ticker);
CREATE INDEX IF NOT EXISTS idx_community_bookmarks_region ON public.community_bookmarks(region);
CREATE INDEX IF NOT EXISTS idx_community_bookmarks_user_region ON public.community_bookmarks(user_id, region);

-- Enable RLS
ALTER TABLE public.community_bookmarks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own bookmarks"
    ON public.community_bookmarks FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bookmarks"
    ON public.community_bookmarks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bookmarks"
    ON public.community_bookmarks FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- 2. CREATE RPC FUNCTIONS FOR BOOKMARK OPERATIONS
-- ============================================================================

-- Toggle bookmark (add if not exists, remove if exists)
CREATE OR REPLACE FUNCTION public.toggle_community_bookmark(
    p_ticker TEXT,
    p_region TEXT DEFAULT 'USA'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_is_bookmarked BOOLEAN;
BEGIN
    -- Get user ID from JWT
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated to bookmark';
    END IF;

    -- Check if bookmark exists
    SELECT EXISTS(
        SELECT 1 FROM public.community_bookmarks
        WHERE user_id = v_user_id
          AND ticker = p_ticker
          AND region = p_region
    ) INTO v_is_bookmarked;

    -- Toggle bookmark
    IF v_is_bookmarked THEN
        -- Remove bookmark
        DELETE FROM public.community_bookmarks
        WHERE user_id = v_user_id
          AND ticker = p_ticker
          AND region = p_region;
        v_is_bookmarked := false;
    ELSE
        -- Add bookmark
        INSERT INTO public.community_bookmarks (user_id, ticker, region)
        VALUES (v_user_id, p_ticker, p_region)
        ON CONFLICT (user_id, ticker, region) DO NOTHING;
        v_is_bookmarked := true;
    END IF;

    RETURN jsonb_build_object(
        'is_bookmarked', v_is_bookmarked,
        'ticker', p_ticker,
        'region', p_region
    );
END;
$$;

-- Get user's bookmarked tickers for a region
CREATE OR REPLACE FUNCTION public.get_user_bookmarked_tickers(
    p_region TEXT DEFAULT 'USA'
)
RETURNS TABLE(ticker TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Get user ID from JWT
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN; -- Return empty if not authenticated
    END IF;

    RETURN QUERY
    SELECT b.ticker
    FROM public.community_bookmarks b
    WHERE b.user_id = v_user_id
      AND b.region = p_region
    ORDER BY b.created_at DESC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.toggle_community_bookmark(TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_user_bookmarked_tickers(TEXT) TO authenticated, anon;

