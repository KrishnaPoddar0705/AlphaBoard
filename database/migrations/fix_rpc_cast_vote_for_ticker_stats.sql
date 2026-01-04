-- Migration: Fix rpc_cast_vote to update community_ticker_stats
-- Purpose: Ensure votes update community_ticker_stats immediately, not just community_stocks
-- Date: 2025-01-27

-- ============================================================================
-- 1. UPDATE rpc_cast_vote TO UPDATE community_ticker_stats
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_cast_vote(
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
    v_region text;
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

    -- Determine region for stocks
    IF p_target_type = 'stock' THEN
        v_region := CASE 
            WHEN p_target_id LIKE '%.NS' OR p_target_id LIKE '%.BO' THEN 'India'
            ELSE 'USA'
        END;
        
        -- Ensure stock exists in community_ticker_stats
        INSERT INTO public.community_ticker_stats (ticker, region, threads_count, comments_count, score, upvotes, downvotes, updated_at)
        VALUES (p_target_id, v_region, 0, 0, 0, 0, 0, NOW())
        ON CONFLICT (ticker, region) DO NOTHING;
        
        -- Also ensure it exists in community_stocks (for backward compatibility)
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
    -- Transition: +1 -> -1 (flip vote)
    ELSIF v_existing_value = 1 AND p_new_value = -1 THEN
        v_delta_up := -1;
        v_delta_down := 1;
        v_delta_score := -2;
    -- Transition: -1 -> +1 (flip vote)
    ELSIF v_existing_value = -1 AND p_new_value = 1 THEN
        v_delta_up := 1;
        v_delta_down := -1;
        v_delta_score := 2;
    -- Transition: same value (no change)
    ELSE
        -- Return current values without updating
        IF p_target_type = 'post' THEN
            SELECT jsonb_build_object(
                'score', score,
                'upvotes', upvotes,
                'downvotes', downvotes,
                'my_vote', p_new_value
            ) INTO v_result
            FROM public.community_posts
            WHERE id = v_target_uuid;
        ELSIF p_target_type = 'comment' THEN
            SELECT jsonb_build_object(
                'score', score,
                'upvotes', upvotes,
                'downvotes', downvotes,
                'my_vote', p_new_value
            ) INTO v_result
            FROM public.community_comments
            WHERE id = v_target_uuid;
        ELSIF p_target_type = 'stock' THEN
            SELECT jsonb_build_object(
                'score', score,
                'upvotes', upvotes,
                'downvotes', downvotes,
                'my_vote', p_new_value
            ) INTO v_result
            FROM public.community_ticker_stats
            WHERE ticker = p_target_id AND region = v_region;
        END IF;
        RETURN v_result;
    END IF;

    -- Upsert vote record
    INSERT INTO public.community_votes (user_id, target_type, target_id, value)
    VALUES (v_user_id, p_target_type, p_target_id, p_new_value)
    ON CONFLICT (user_id, target_type, target_id)
    DO UPDATE SET value = p_new_value;

    -- Update target-specific counters
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
        -- Update community_ticker_stats (primary)
        UPDATE public.community_ticker_stats
        SET 
            upvotes = GREATEST(0, upvotes + v_delta_up),
            downvotes = GREATEST(0, downvotes + v_delta_down),
            score = score + v_delta_score,
            updated_at = NOW()
        WHERE ticker = p_target_id AND region = v_region;
        
        -- Also update community_stocks (for backward compatibility)
        UPDATE public.community_stocks
        SET 
            upvotes = GREATEST(0, upvotes + v_delta_up),
            downvotes = GREATEST(0, downvotes + v_delta_down),
            score = score + v_delta_score
        WHERE ticker = p_target_id;
        
        -- Return updated counts from community_ticker_stats
        SELECT jsonb_build_object(
            'score', score,
            'upvotes', upvotes,
            'downvotes', downvotes,
            'my_vote', p_new_value
        ) INTO v_result
        FROM public.community_ticker_stats
        WHERE ticker = p_target_id AND region = v_region;
    END IF;

    RETURN v_result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.rpc_cast_vote(text, text, smallint) TO authenticated, anon, service_role;

