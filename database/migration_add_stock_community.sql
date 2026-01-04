-- Migration: Add stock community features (comments, votes, watchlist, history)
-- Purpose: Enable Reddit-like community features for stock discussions
-- Date: 2025-01-27

-- ============================================================================
-- 1. CREATE STOCK_COMMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.stock_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker TEXT NOT NULL,
    user_id TEXT, -- Clerk user ID (nullable for anonymous users)
    content TEXT NOT NULL,
    parent_id UUID REFERENCES public.stock_comments(id) ON DELETE CASCADE, -- For nested comments
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_stock_comments_ticker ON public.stock_comments(ticker);
CREATE INDEX IF NOT EXISTS idx_stock_comments_user ON public.stock_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_comments_parent ON public.stock_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_stock_comments_created ON public.stock_comments(created_at DESC);

-- ============================================================================
-- 2. CREATE STOCK_VOTES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.stock_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker TEXT NOT NULL,
    user_id TEXT, -- Clerk user ID (nullable for anonymous users)
    vote_type TEXT CHECK (vote_type IN ('upvote', 'downvote')) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(ticker, user_id) -- One vote per user per stock
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stock_votes_ticker ON public.stock_votes(ticker);
CREATE INDEX IF NOT EXISTS idx_stock_votes_user ON public.stock_votes(user_id);

-- ============================================================================
-- 3. CREATE COMMENT_VOTES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.comment_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID REFERENCES public.stock_comments(id) ON DELETE CASCADE NOT NULL,
    user_id TEXT, -- Clerk user ID (nullable for anonymous users)
    vote_type TEXT CHECK (vote_type IN ('upvote', 'downvote')) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(comment_id, user_id) -- One vote per user per comment
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_comment_votes_comment ON public.comment_votes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_votes_user ON public.comment_votes(user_id);

-- ============================================================================
-- 4. CREATE USER_STOCK_WATCHLIST TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_stock_watchlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL, -- Clerk user ID
    ticker TEXT NOT NULL,
    added_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(user_id, ticker) -- One entry per user per stock
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_watchlist_user ON public.user_stock_watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_ticker ON public.user_stock_watchlist(ticker);

-- ============================================================================
-- 5. CREATE USER_STOCK_HISTORY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_stock_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL, -- Clerk user ID
    ticker TEXT NOT NULL,
    viewed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_history_user ON public.user_stock_history(user_id);
CREATE INDEX IF NOT EXISTS idx_history_ticker ON public.user_stock_history(ticker);
CREATE INDEX IF NOT EXISTS idx_history_viewed ON public.user_stock_history(viewed_at DESC);

-- ============================================================================
-- 6. ENABLE ROW LEVEL SECURITY
-- ============================================================================

-- Stock Comments: Everyone can read, authenticated users can write
ALTER TABLE public.stock_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stock comments are viewable by everyone"
    ON public.stock_comments FOR SELECT
    USING (true);

CREATE POLICY "Anyone can create comments"
    ON public.stock_comments FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users can update their own comments"
    ON public.stock_comments FOR UPDATE
    USING (user_id = auth.jwt() ->> 'sub' OR user_id IS NULL);

CREATE POLICY "Users can delete their own comments"
    ON public.stock_comments FOR DELETE
    USING (user_id = auth.jwt() ->> 'sub' OR user_id IS NULL);

-- Stock Votes: Everyone can read, anyone can vote
ALTER TABLE public.stock_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stock votes are viewable by everyone"
    ON public.stock_votes FOR SELECT
    USING (true);

CREATE POLICY "Anyone can create votes"
    ON public.stock_votes FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users can update their own votes"
    ON public.stock_votes FOR UPDATE
    USING (user_id = auth.jwt() ->> 'sub' OR user_id IS NULL);

CREATE POLICY "Users can delete their own votes"
    ON public.stock_votes FOR DELETE
    USING (user_id = auth.jwt() ->> 'sub' OR user_id IS NULL);

-- Comment Votes: Everyone can read, anyone can vote
ALTER TABLE public.comment_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comment votes are viewable by everyone"
    ON public.comment_votes FOR SELECT
    USING (true);

CREATE POLICY "Anyone can create comment votes"
    ON public.comment_votes FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users can update their own comment votes"
    ON public.comment_votes FOR UPDATE
    USING (user_id = auth.jwt() ->> 'sub' OR user_id IS NULL);

CREATE POLICY "Users can delete their own comment votes"
    ON public.comment_votes FOR DELETE
    USING (user_id = auth.jwt() ->> 'sub' OR user_id IS NULL);

-- Watchlist: Users can only see their own
ALTER TABLE public.user_stock_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own watchlist"
    ON public.user_stock_watchlist FOR SELECT
    USING (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can add to their own watchlist"
    ON public.user_stock_watchlist FOR INSERT
    WITH CHECK (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can delete from their own watchlist"
    ON public.user_stock_watchlist FOR DELETE
    USING (user_id = auth.jwt() ->> 'sub');

-- History: Users can only see their own
ALTER TABLE public.user_stock_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own history"
    ON public.user_stock_history FOR SELECT
    USING (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can add to their own history"
    ON public.user_stock_history FOR INSERT
    WITH CHECK (user_id = auth.jwt() ->> 'sub');

-- ============================================================================
-- 7. CREATE FUNCTIONS TO UPDATE VOTE COUNTS
-- ============================================================================

-- Function to update comment vote counts
CREATE OR REPLACE FUNCTION update_comment_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.vote_type = 'upvote' THEN
            UPDATE public.stock_comments SET upvotes = upvotes + 1 WHERE id = NEW.comment_id;
        ELSE
            UPDATE public.stock_comments SET downvotes = downvotes + 1 WHERE id = NEW.comment_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Remove old vote
        IF OLD.vote_type = 'upvote' THEN
            UPDATE public.stock_comments SET upvotes = upvotes - 1 WHERE id = OLD.comment_id;
        ELSE
            UPDATE public.stock_comments SET downvotes = downvotes - 1 WHERE id = OLD.comment_id;
        END IF;
        -- Add new vote
        IF NEW.vote_type = 'upvote' THEN
            UPDATE public.stock_comments SET upvotes = upvotes + 1 WHERE id = NEW.comment_id;
        ELSE
            UPDATE public.stock_comments SET downvotes = downvotes + 1 WHERE id = NEW.comment_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.vote_type = 'upvote' THEN
            UPDATE public.stock_comments SET upvotes = upvotes - 1 WHERE id = OLD.comment_id;
        ELSE
            UPDATE public.stock_comments SET downvotes = downvotes - 1 WHERE id = OLD.comment_id;
        END IF;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for comment votes
DROP TRIGGER IF EXISTS trigger_update_comment_vote_counts ON public.comment_votes;
CREATE TRIGGER trigger_update_comment_vote_counts
    AFTER INSERT OR UPDATE OR DELETE ON public.comment_votes
    FOR EACH ROW EXECUTE FUNCTION update_comment_vote_counts();

