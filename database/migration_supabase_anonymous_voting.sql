-- Migration: Supabase Anonymous Voting System
-- Purpose: Migrate from random UUID-based anonymous voting to Supabase anonymous authentication
-- Date: 2025-01-XX

-- ============================================================================
-- 1. RESTORE FOREIGN KEY CONSTRAINT
-- ============================================================================

-- Drop existing constraint if it exists
ALTER TABLE public.community_votes 
DROP CONSTRAINT IF EXISTS community_votes_user_id_fkey;

-- Add constraint with NOT VALID to allow existing orphaned votes
-- These will be cleaned up later or can remain as historical data
-- New inserts will be validated against the constraint
ALTER TABLE public.community_votes 
ADD CONSTRAINT community_votes_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
NOT VALID;

-- ============================================================================
-- 2. UPDATE RPC FUNCTION TO USE auth.uid()
-- ============================================================================

-- Drop existing function with old signature
DROP FUNCTION IF EXISTS public.rpc_cast_vote(text, text, smallint, uuid) CASCADE;

-- Create new function without p_user_id parameter (uses auth.uid() directly)
CREATE FUNCTION public.rpc_cast_vote(
    p_target_type text,
    p_target_id text, -- UUID for posts/comments, ticker string for stocks
    p_new_value smallint -- NULL to remove vote, 1 for upvote, -1 for downvote
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_existing_value smallint;
    v_delta_up integer := 0;
    v_delta_down integer := 0;
    v_delta_score integer := 0;
    v_result jsonb;
    v_target_uuid uuid;
    v_user_id uuid;
BEGIN
    -- Get user ID from JWT (works for both authenticated and anonymous users)
    v_user_id := auth.uid();
    
    -- Validate user is authenticated (anonymous users are still "authenticated" role)
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated to vote';
    END IF;

    -- Validate target_type
    IF p_target_type NOT IN ('post', 'comment', 'stock') THEN
        RAISE EXCEPTION 'Invalid target_type: %', p_target_type;
    END IF;

    -- Convert target_id to UUID for posts/comments, keep as text for stocks
    IF p_target_type IN ('post', 'comment') THEN
        BEGIN
            v_target_uuid := p_target_id::uuid;
        EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Invalid UUID format for target_id: %', p_target_id;
        END;
    END IF;

    -- Ensure stock exists with defaults if voting on a stock
    IF p_target_type = 'stock' THEN
        INSERT INTO public.community_stocks (ticker, score, upvotes, downvotes, thread_count, comment_count)
        VALUES (p_target_id, 0, 0, 0, 0, 0)
        ON CONFLICT (ticker) DO NOTHING;
    END IF;

    -- Get existing vote value (NULL if no vote exists)
    SELECT value INTO v_existing_value
    FROM public.community_votes
    WHERE user_id = v_user_id
      AND target_type = p_target_type
      AND target_id = p_target_id;

    -- Calculate deltas based on transition
    -- Transition: none -> +1
    IF v_existing_value IS NULL AND p_new_value = 1 THEN
        v_delta_up := 1;
        v_delta_score := 1;
    -- Transition: none -> -1
    ELSIF v_existing_value IS NULL AND p_new_value = -1 THEN
        v_delta_down := 1;
        v_delta_score := -1;
    -- Transition: +1 -> none (remove vote)
    ELSIF v_existing_value = 1 AND p_new_value IS NULL THEN
        v_delta_up := -1;
        v_delta_score := -1;
    -- Transition: -1 -> none (remove vote)
    ELSIF v_existing_value = -1 AND p_new_value IS NULL THEN
        v_delta_down := -1;
        v_delta_score := 1;
    -- Transition: +1 -> -1 (switch)
    ELSIF v_existing_value = 1 AND p_new_value = -1 THEN
        v_delta_up := -1;
        v_delta_down := 1;
        v_delta_score := -2;
    -- Transition: -1 -> +1 (switch)
    ELSIF v_existing_value = -1 AND p_new_value = 1 THEN
        v_delta_up := 1;
        v_delta_down := -1;
        v_delta_score := 2;
    END IF;

    -- Apply vote changes
    IF p_new_value IS NULL THEN
        -- Remove vote
        DELETE FROM public.community_votes
        WHERE user_id = v_user_id
          AND target_type = p_target_type
          AND target_id = p_target_id;
    ELSE
        -- Insert or update vote
        INSERT INTO public.community_votes (
            user_id,
            target_type,
            target_id,
            value
        ) VALUES (
            v_user_id,
            p_target_type,
            p_target_id,
            p_new_value
        )
        ON CONFLICT (user_id, target_type, target_id)
        DO UPDATE SET value = p_new_value;
    END IF;

    -- Update target table counters atomically
    IF p_target_type = 'post' THEN
        UPDATE public.community_posts
        SET 
            upvotes = GREATEST(0, upvotes + v_delta_up),
            downvotes = GREATEST(0, downvotes + v_delta_down),
            score = score + v_delta_score
        WHERE id = v_target_uuid;
        
        -- Return updated counts
        SELECT jsonb_build_object(
            'score', score,
            'upvotes', upvotes,
            'downvotes', downvotes,
            'my_vote', p_new_value
        ) INTO v_result
        FROM public.community_posts
        WHERE id = v_target_uuid;
        
    ELSIF p_target_type = 'comment' THEN
        UPDATE public.community_comments
        SET 
            upvotes = GREATEST(0, upvotes + v_delta_up),
            downvotes = GREATEST(0, downvotes + v_delta_down),
            score = score + v_delta_score
        WHERE id = v_target_uuid;
        
        -- Return updated counts
        SELECT jsonb_build_object(
            'score', score,
            'upvotes', upvotes,
            'downvotes', downvotes,
            'my_vote', p_new_value
        ) INTO v_result
        FROM public.community_comments
        WHERE id = v_target_uuid;
        
    ELSIF p_target_type = 'stock' THEN
        UPDATE public.community_stocks
        SET 
            upvotes = GREATEST(0, upvotes + v_delta_up),
            downvotes = GREATEST(0, downvotes + v_delta_down),
            score = score + v_delta_score
        WHERE ticker = p_target_id;
        
        -- Return updated counts
        SELECT jsonb_build_object(
            'score', score,
            'upvotes', upvotes,
            'downvotes', downvotes,
            'my_vote', p_new_value
        ) INTO v_result
        FROM public.community_stocks
        WHERE ticker = p_target_id;
    END IF;

    RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users (includes anonymous users)
GRANT EXECUTE ON FUNCTION public.rpc_cast_vote(text, text, smallint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_cast_vote(text, text, smallint) TO anon;

-- ============================================================================
-- 3. VERIFY RLS POLICIES (Already correct, but document here)
-- ============================================================================

-- RLS policies on community_votes should allow:
-- - SELECT: authenticated users can see their own votes
-- - INSERT/UPDATE/DELETE: authenticated users can modify their own votes
-- Anonymous users are "authenticated" role, so these policies work automatically

-- Note: If policies need to be updated, they should check:
--   USING (user_id = auth.uid())
--   WITH CHECK (user_id = auth.uid())

