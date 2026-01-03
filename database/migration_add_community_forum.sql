-- Migration: Add Reddit-style community forum for stock discussions
-- Purpose: Enable ticker-scoped posts, threaded comments, voting, and image attachments
-- Date: 2025-01-XX

-- ============================================================================
-- 1. CREATE TABLES
-- ============================================================================

-- Community posts table
CREATE TABLE IF NOT EXISTS public.community_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker TEXT NOT NULL,
    title TEXT NOT NULL CHECK (char_length(title) <= 120),
    body TEXT NOT NULL,
    author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    author_display TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    score INTEGER DEFAULT 0 NOT NULL,
    comment_count INTEGER DEFAULT 0 NOT NULL,
    last_activity_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL
);

-- Community comments table (threaded)
CREATE TABLE IF NOT EXISTS public.community_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES public.community_comments(id) ON DELETE CASCADE,
    depth INTEGER DEFAULT 0 NOT NULL CHECK (depth >= 0 AND depth <= 6),
    path TEXT NOT NULL, -- Materialized path like '0001.0004.0010'
    body TEXT NOT NULL,
    author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    author_display TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    score INTEGER DEFAULT 0 NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL
);

-- Community votes table (for posts and comments)
CREATE TABLE IF NOT EXISTS public.community_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment')),
    target_id UUID NOT NULL,
    value INTEGER NOT NULL CHECK (value IN (-1, 1)),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(user_id, target_type, target_id)
);

-- Community attachments table (images for posts and comments)
CREATE TABLE IF NOT EXISTS public.community_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment')),
    target_id UUID NOT NULL,
    author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    mime TEXT NOT NULL CHECK (mime IN ('image/png', 'image/jpeg')),
    width INTEGER,
    height INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- 2. CREATE INDEXES
-- ============================================================================

-- Posts indexes for sorting
CREATE INDEX IF NOT EXISTS idx_community_posts_ticker_last_activity 
    ON public.community_posts(ticker, last_activity_at DESC) 
    WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_community_posts_ticker_created 
    ON public.community_posts(ticker, created_at DESC) 
    WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_community_posts_ticker_score 
    ON public.community_posts(ticker, score DESC) 
    WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_community_posts_ticker 
    ON public.community_posts(ticker) 
    WHERE is_deleted = FALSE;

-- Comments indexes
CREATE INDEX IF NOT EXISTS idx_community_comments_post_id 
    ON public.community_comments(post_id) 
    WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_community_comments_post_path 
    ON public.community_comments(post_id, path) 
    WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_community_comments_parent 
    ON public.community_comments(parent_comment_id) 
    WHERE is_deleted = FALSE;

-- Votes indexes
CREATE INDEX IF NOT EXISTS idx_community_votes_target 
    ON public.community_votes(target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_community_votes_user 
    ON public.community_votes(user_id);

-- Attachments indexes
CREATE INDEX IF NOT EXISTS idx_community_attachments_target 
    ON public.community_attachments(target_type, target_id);

-- ============================================================================
-- 3. CREATE FUNCTIONS
-- ============================================================================

-- Function to update post score from votes
CREATE OR REPLACE FUNCTION public.update_post_score()
RETURNS TRIGGER AS $$
DECLARE
    target_id_val UUID;
BEGIN
    -- Get target_id from NEW (INSERT/UPDATE) or OLD (DELETE)
    target_id_val := COALESCE(NEW.target_id, OLD.target_id);
    
    UPDATE public.community_posts
    SET score = (
        SELECT COALESCE(SUM(value), 0)
        FROM public.community_votes
        WHERE target_type = 'post' AND target_id = target_id_val
    )
    WHERE id = target_id_val;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Function to update comment score from votes
CREATE OR REPLACE FUNCTION public.update_comment_score()
RETURNS TRIGGER AS $$
DECLARE
    target_id_val UUID;
BEGIN
    -- Get target_id from NEW (INSERT/UPDATE) or OLD (DELETE)
    target_id_val := COALESCE(NEW.target_id, OLD.target_id);
    
    UPDATE public.community_comments
    SET score = (
        SELECT COALESCE(SUM(value), 0)
        FROM public.community_votes
        WHERE target_type = 'comment' AND target_id = target_id_val
    )
    WHERE id = target_id_val;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Function to update comment count and last activity on post
CREATE OR REPLACE FUNCTION public.update_post_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.community_posts
        SET 
            comment_count = comment_count + 1,
            last_activity_at = NOW()
        WHERE id = NEW.post_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.community_posts
        SET comment_count = GREATEST(0, comment_count - 1)
        WHERE id = OLD.post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to generate path for nested comments
CREATE OR REPLACE FUNCTION public.generate_comment_path(parent_id UUID, post_id UUID)
RETURNS TEXT AS $$
DECLARE
    parent_path TEXT;
    max_sibling INTEGER;
    new_path TEXT;
BEGIN
    IF parent_id IS NULL THEN
        -- Root level comment
        SELECT COALESCE(MAX(CAST(SUBSTRING(path FROM '^[0-9]+') AS INTEGER)), 0) + 1
        INTO max_sibling
        FROM public.community_comments
        WHERE post_id = generate_comment_path.post_id AND parent_comment_id IS NULL;
        
        RETURN LPAD(max_sibling::TEXT, 4, '0');
    ELSE
        -- Nested comment
        SELECT path INTO parent_path
        FROM public.community_comments
        WHERE id = parent_id;
        
        SELECT COALESCE(MAX(CAST(SUBSTRING(path FROM '[0-9]+$') AS INTEGER)), 0) + 1
        INTO max_sibling
        FROM public.community_comments
        WHERE post_id = generate_comment_path.post_id 
          AND path LIKE parent_path || '.%'
          AND depth = (SELECT depth + 1 FROM public.community_comments WHERE id = parent_id);
        
        RETURN parent_path || '.' || LPAD(max_sibling::TEXT, 4, '0');
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. CREATE TRIGGERS
-- ============================================================================

-- Trigger to update post score when votes change (INSERT/UPDATE)
DROP TRIGGER IF EXISTS trigger_update_post_score_insert_update ON public.community_votes;
CREATE TRIGGER trigger_update_post_score_insert_update
    AFTER INSERT OR UPDATE ON public.community_votes
    FOR EACH ROW
    WHEN (NEW.target_type = 'post')
    EXECUTE FUNCTION public.update_post_score();

-- Trigger to update post score when votes change (DELETE)
DROP TRIGGER IF EXISTS trigger_update_post_score_delete ON public.community_votes;
CREATE TRIGGER trigger_update_post_score_delete
    AFTER DELETE ON public.community_votes
    FOR EACH ROW
    WHEN (OLD.target_type = 'post')
    EXECUTE FUNCTION public.update_post_score();

-- Trigger to update comment score when votes change (INSERT/UPDATE)
DROP TRIGGER IF EXISTS trigger_update_comment_score_insert_update ON public.community_votes;
CREATE TRIGGER trigger_update_comment_score_insert_update
    AFTER INSERT OR UPDATE ON public.community_votes
    FOR EACH ROW
    WHEN (NEW.target_type = 'comment')
    EXECUTE FUNCTION public.update_comment_score();

-- Trigger to update comment score when votes change (DELETE)
DROP TRIGGER IF EXISTS trigger_update_comment_score_delete ON public.community_votes;
CREATE TRIGGER trigger_update_comment_score_delete
    AFTER DELETE ON public.community_votes
    FOR EACH ROW
    WHEN (OLD.target_type = 'comment')
    EXECUTE FUNCTION public.update_comment_score();

-- Trigger to update post activity when comments change
DROP TRIGGER IF EXISTS trigger_update_post_activity ON public.community_comments;
CREATE TRIGGER trigger_update_post_activity
    AFTER INSERT OR DELETE ON public.community_comments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_post_activity();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_posts_updated_at ON public.community_posts;
CREATE TRIGGER trigger_update_posts_updated_at
    BEFORE UPDATE ON public.community_posts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trigger_update_comments_updated_at ON public.community_comments;
CREATE TRIGGER trigger_update_comments_updated_at
    BEFORE UPDATE ON public.community_comments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_attachments ENABLE ROW LEVEL SECURITY;

-- Community Posts Policies
CREATE POLICY "Anyone can read posts"
    ON public.community_posts FOR SELECT
    USING (NOT is_deleted);

CREATE POLICY "Authenticated users can create posts"
    ON public.community_posts FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update their own posts"
    ON public.community_posts FOR UPDATE
    TO authenticated
    USING (auth.uid() = author_id)
    WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can delete their own posts"
    ON public.community_posts FOR UPDATE
    TO authenticated
    USING (auth.uid() = author_id)
    WITH CHECK (auth.uid() = author_id AND is_deleted = TRUE);

-- Community Comments Policies
CREATE POLICY "Anyone can read comments"
    ON public.community_comments FOR SELECT
    USING (NOT is_deleted);

CREATE POLICY "Authenticated users can create comments"
    ON public.community_comments FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update their own comments"
    ON public.community_comments FOR UPDATE
    TO authenticated
    USING (auth.uid() = author_id)
    WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can delete their own comments"
    ON public.community_comments FOR UPDATE
    TO authenticated
    USING (auth.uid() = author_id)
    WITH CHECK (auth.uid() = author_id AND is_deleted = TRUE);

-- Community Votes Policies
CREATE POLICY "Anyone can read votes"
    ON public.community_votes FOR SELECT
    USING (TRUE);

CREATE POLICY "Authenticated users can create votes"
    ON public.community_votes FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own votes"
    ON public.community_votes FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own votes"
    ON public.community_votes FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Community Attachments Policies
CREATE POLICY "Anyone can read attachments"
    ON public.community_attachments FOR SELECT
    USING (TRUE);

CREATE POLICY "Authenticated users can create attachments"
    ON public.community_attachments FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can delete their own attachments"
    ON public.community_attachments FOR DELETE
    TO authenticated
    USING (auth.uid() = author_id);

-- ============================================================================
-- 6. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON public.community_posts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.community_comments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_votes TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.community_attachments TO authenticated;

GRANT SELECT ON public.community_posts TO anon;
GRANT SELECT ON public.community_comments TO anon;
GRANT SELECT ON public.community_votes TO anon;
GRANT SELECT ON public.community_attachments TO anon;

