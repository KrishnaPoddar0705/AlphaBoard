-- Migration: Add WhatsApp integration tables
-- Purpose: Support WhatsApp bot users, watchlists, and recommendations
-- Date: 2025-01-XX

-- ============================================================================
-- 1. CREATE WHATSAPP_USERS TABLE
-- ============================================================================

-- Maps WhatsApp phone numbers to AlphaBoard users
-- Note: supabase_user_id is TEXT because Clerk user IDs are strings (e.g., "user_xxxxx")
CREATE TABLE IF NOT EXISTS public.whatsapp_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT UNIQUE NOT NULL,                     -- E.164 format (e.g., +919876543210)
    supabase_user_id TEXT,                          -- Clerk user ID (string, not UUID)
    display_name TEXT,
    is_daily_subscriber BOOLEAN DEFAULT TRUE,       -- Subscribed to daily market close reports
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    last_active_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_users_phone ON public.whatsapp_users(phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_users_supabase_id ON public.whatsapp_users(supabase_user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_users_daily_subscriber ON public.whatsapp_users(is_daily_subscriber) WHERE is_daily_subscriber = TRUE;

-- ============================================================================
-- 2. CREATE WHATSAPP_WATCHLIST TABLE
-- ============================================================================

-- User watchlist items added via WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_watchlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    whatsapp_user_id UUID NOT NULL REFERENCES public.whatsapp_users(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT unique_whatsapp_watchlist_ticker UNIQUE (whatsapp_user_id, ticker)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_watchlist_user ON public.whatsapp_watchlist(whatsapp_user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_watchlist_ticker ON public.whatsapp_watchlist(ticker);

-- ============================================================================
-- 3. CREATE WHATSAPP_RECOMMENDATIONS TABLE
-- ============================================================================

-- Recommendations added via WhatsApp (linked to main recommendations table)
CREATE TABLE IF NOT EXISTS public.whatsapp_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    whatsapp_user_id UUID NOT NULL REFERENCES public.whatsapp_users(id) ON DELETE CASCADE,
    recommendation_id UUID REFERENCES public.recommendations(id) ON DELETE SET NULL,
    ticker TEXT NOT NULL,
    price NUMERIC,
    thesis TEXT,
    source TEXT DEFAULT 'whatsapp',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_recommendations_user ON public.whatsapp_recommendations(whatsapp_user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_recommendations_created ON public.whatsapp_recommendations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_recommendations_ticker ON public.whatsapp_recommendations(ticker);

-- ============================================================================
-- 4. CREATE WHATSAPP_PODCAST_REQUESTS TABLE
-- ============================================================================

-- Track podcast requests from WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_podcast_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    whatsapp_user_id UUID NOT NULL REFERENCES public.whatsapp_users(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    podcast_id UUID REFERENCES public.podcasts(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_podcast_requests_user ON public.whatsapp_podcast_requests(whatsapp_user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_podcast_requests_status ON public.whatsapp_podcast_requests(status);

-- ============================================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.whatsapp_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_podcast_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. RLS POLICIES (Drop existing first to avoid conflicts)
-- ============================================================================

-- WhatsApp users: Service role has full access (for bot operations)
-- Users can view their own data if linked to a Supabase account
DROP POLICY IF EXISTS "Service role has full access to whatsapp_users" ON public.whatsapp_users;
CREATE POLICY "Service role has full access to whatsapp_users"
    ON public.whatsapp_users
    FOR ALL
    USING (TRUE)
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Users can view their linked whatsapp account" ON public.whatsapp_users;
CREATE POLICY "Users can view their linked whatsapp account"
    ON public.whatsapp_users
    FOR SELECT
    USING (auth.uid()::TEXT = supabase_user_id);

-- WhatsApp watchlist
DROP POLICY IF EXISTS "Service role has full access to whatsapp_watchlist" ON public.whatsapp_watchlist;
CREATE POLICY "Service role has full access to whatsapp_watchlist"
    ON public.whatsapp_watchlist
    FOR ALL
    USING (TRUE)
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Users can view their linked whatsapp watchlist" ON public.whatsapp_watchlist;
CREATE POLICY "Users can view their linked whatsapp watchlist"
    ON public.whatsapp_watchlist
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.whatsapp_users wu
            WHERE wu.id = whatsapp_user_id AND wu.supabase_user_id = auth.uid()::TEXT
        )
    );

-- WhatsApp recommendations
DROP POLICY IF EXISTS "Service role has full access to whatsapp_recommendations" ON public.whatsapp_recommendations;
CREATE POLICY "Service role has full access to whatsapp_recommendations"
    ON public.whatsapp_recommendations
    FOR ALL
    USING (TRUE)
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Users can view their linked whatsapp recommendations" ON public.whatsapp_recommendations;
CREATE POLICY "Users can view their linked whatsapp recommendations"
    ON public.whatsapp_recommendations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.whatsapp_users wu
            WHERE wu.id = whatsapp_user_id AND wu.supabase_user_id = auth.uid()::TEXT
        )
    );

-- WhatsApp podcast requests
DROP POLICY IF EXISTS "Service role has full access to whatsapp_podcast_requests" ON public.whatsapp_podcast_requests;
CREATE POLICY "Service role has full access to whatsapp_podcast_requests"
    ON public.whatsapp_podcast_requests
    FOR ALL
    USING (TRUE)
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Users can view their linked podcast requests" ON public.whatsapp_podcast_requests;
CREATE POLICY "Users can view their linked podcast requests"
    ON public.whatsapp_podcast_requests
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.whatsapp_users wu
            WHERE wu.id = whatsapp_user_id AND wu.supabase_user_id = auth.uid()::TEXT
        )
    );

-- ============================================================================
-- 7. UPDATE TRIGGERS
-- ============================================================================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_whatsapp_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_whatsapp_users_updated_at ON public.whatsapp_users;
CREATE TRIGGER update_whatsapp_users_updated_at
    BEFORE UPDATE ON public.whatsapp_users
    FOR EACH ROW
    EXECUTE FUNCTION public.update_whatsapp_users_updated_at();

-- ============================================================================
-- 8. CREATE WHATSAPP_LINK_CODES TABLE
-- ============================================================================

-- Temporary codes for linking WhatsApp accounts to AlphaBoard accounts
-- Note: linked_supabase_user_id is TEXT because Clerk user IDs are strings (e.g., "user_xxxxx")
CREATE TABLE IF NOT EXISTS public.whatsapp_link_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    whatsapp_user_id UUID NOT NULL REFERENCES public.whatsapp_users(id) ON DELETE CASCADE,
    code TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    linked_supabase_user_id TEXT,  -- Clerk user ID (string, not UUID)
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_link_codes_code ON public.whatsapp_link_codes(code);
CREATE INDEX IF NOT EXISTS idx_whatsapp_link_codes_user ON public.whatsapp_link_codes(whatsapp_user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_link_codes_expires ON public.whatsapp_link_codes(expires_at);

-- RLS
ALTER TABLE public.whatsapp_link_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role has full access to whatsapp_link_codes" ON public.whatsapp_link_codes;
CREATE POLICY "Service role has full access to whatsapp_link_codes"
    ON public.whatsapp_link_codes
    FOR ALL
    USING (TRUE)
    WITH CHECK (TRUE);

-- ============================================================================
-- 9. NOTIFY SUPABASE TO RELOAD SCHEMA
-- ============================================================================

NOTIFY pgrst, 'reload schema';

