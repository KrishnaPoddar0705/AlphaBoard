-- Migration: Fix post and comment vote counts and ensure my_vote is properly loaded
-- Purpose: Recalculate vote counts from community_votes and ensure consistency
-- Date: 2025-01-27

-- ============================================================================
-- 1. CREATE FUNCTION TO RECALCULATE POST VOTE COUNTS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.recalc_post_vote_counts(_post_id UUID DEFAULT NULL)
RETURNS TABLE(
  post_id UUID,
  updated_count INT
)
LANGUAGE plpgsql
AS $$
DECLARE
  updated_rows INT;
BEGIN
  -- Recalculate vote counts for posts from community_votes
  WITH vote_aggregates AS (
    SELECT
      v.target_id::uuid as post_id,
      COUNT(*) FILTER (WHERE v.value = 1)::INTEGER as upvotes,
      COUNT(*) FILTER (WHERE v.value = -1)::INTEGER as downvotes,
      COALESCE(SUM(v.value), 0)::INTEGER as score
    FROM public.community_votes v
    WHERE v.target_type = 'post'
      AND (_post_id IS NULL OR v.target_id::uuid = _post_id)
    GROUP BY v.target_id::uuid
  )
  UPDATE public.community_posts p
  SET 
    upvotes = COALESCE(va.upvotes, 0),
    downvotes = COALESCE(va.downvotes, 0),
    score = COALESCE(va.score, 0)
  FROM vote_aggregates va
  WHERE p.id = va.post_id
    AND (
      p.upvotes IS DISTINCT FROM COALESCE(va.upvotes, 0)
      OR p.downvotes IS DISTINCT FROM COALESCE(va.downvotes, 0)
      OR p.score IS DISTINCT FROM COALESCE(va.score, 0)
    );

  GET DIAGNOSTICS updated_rows = ROW_COUNT;

  -- Also update posts with no votes to have 0 counts
  IF _post_id IS NULL THEN
    UPDATE public.community_posts p
    SET 
      upvotes = 0,
      downvotes = 0,
      score = 0
    WHERE NOT EXISTS (
      SELECT 1 FROM public.community_votes v
      WHERE v.target_type = 'post' AND v.target_id::uuid = p.id
    )
    AND (p.upvotes != 0 OR p.downvotes != 0 OR p.score != 0);
  END IF;

  -- Return summary
  RETURN QUERY
  SELECT 
    COALESCE(_post_id, '00000000-0000-0000-0000-000000000000'::uuid) as post_id,
    updated_rows::INT as updated_count;
END;
$$;

-- ============================================================================
-- 2. CREATE FUNCTION TO RECALCULATE COMMENT VOTE COUNTS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.recalc_comment_vote_counts(_comment_id UUID DEFAULT NULL)
RETURNS TABLE(
  comment_id UUID,
  updated_count INT
)
LANGUAGE plpgsql
AS $$
DECLARE
  updated_rows INT;
BEGIN
  -- Recalculate vote counts for comments from community_votes
  WITH vote_aggregates AS (
    SELECT
      v.target_id::uuid as comment_id,
      COUNT(*) FILTER (WHERE v.value = 1)::INTEGER as upvotes,
      COUNT(*) FILTER (WHERE v.value = -1)::INTEGER as downvotes,
      COALESCE(SUM(v.value), 0)::INTEGER as score
    FROM public.community_votes v
    WHERE v.target_type = 'comment'
      AND (_comment_id IS NULL OR v.target_id::uuid = _comment_id)
    GROUP BY v.target_id::uuid
  )
  UPDATE public.community_comments c
  SET 
    upvotes = COALESCE(va.upvotes, 0),
    downvotes = COALESCE(va.downvotes, 0),
    score = COALESCE(va.score, 0)
  FROM vote_aggregates va
  WHERE c.id = va.comment_id
    AND (
      c.upvotes IS DISTINCT FROM COALESCE(va.upvotes, 0)
      OR c.downvotes IS DISTINCT FROM COALESCE(va.downvotes, 0)
      OR c.score IS DISTINCT FROM COALESCE(va.score, 0)
    );

  GET DIAGNOSTICS updated_rows = ROW_COUNT;

  -- Also update comments with no votes to have 0 counts
  IF _comment_id IS NULL THEN
    UPDATE public.community_comments c
    SET 
      upvotes = 0,
      downvotes = 0,
      score = 0
    WHERE NOT EXISTS (
      SELECT 1 FROM public.community_votes v
      WHERE v.target_type = 'comment' AND v.target_id::uuid = c.id
    )
    AND (c.upvotes != 0 OR c.downvotes != 0 OR c.score != 0);
  END IF;

  -- Return summary
  RETURN QUERY
  SELECT 
    COALESCE(_comment_id, '00000000-0000-0000-0000-000000000000'::uuid) as comment_id,
    updated_rows::INT as updated_count;
END;
$$;

-- ============================================================================
-- 3. RECALCULATE ALL POST AND COMMENT VOTE COUNTS
-- ============================================================================

-- Fix all existing vote counts
SELECT * FROM public.recalc_post_vote_counts();
SELECT * FROM public.recalc_comment_vote_counts();

-- ============================================================================
-- 4. UPDATE rpc_cast_vote TO RECALCULATE COUNTS AFTER UPDATE
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
                'my_vote', COALESCE(v_existing_value, NULL)
            ) INTO v_result
            FROM public.community_posts
            WHERE id = v_target_uuid;
        ELSIF p_target_type = 'comment' THEN
            SELECT jsonb_build_object(
                'score', score,
                'upvotes', upvotes,
                'downvotes', downvotes,
                'my_vote', COALESCE(v_existing_value, NULL)
            ) INTO v_result
            FROM public.community_comments
            WHERE id = v_target_uuid;
        ELSIF p_target_type = 'stock' THEN
            SELECT jsonb_build_object(
                'score', score,
                'upvotes', upvotes,
                'downvotes', downvotes,
                'my_vote', COALESCE(v_existing_value, NULL)
            ) INTO v_result
            FROM public.community_ticker_stats
            WHERE ticker = p_target_id AND region = v_region;
        END IF;
        RETURN v_result;
    END IF;

    -- Handle vote record: DELETE if removing vote, INSERT/UPDATE otherwise
    IF p_new_value IS NULL THEN
        -- Delete the vote record when removing vote
        DELETE FROM public.community_votes
        WHERE user_id = v_user_id
          AND target_type = p_target_type
          AND target_id = p_target_id;
    ELSE
        -- Insert or update vote record
        INSERT INTO public.community_votes (user_id, target_type, target_id, value)
        VALUES (v_user_id, p_target_type, p_target_id, p_new_value)
        ON CONFLICT (user_id, target_type, target_id)
        DO UPDATE SET value = p_new_value;
    END IF;

    -- Update target-specific counters using recalc functions for accuracy
    IF p_target_type = 'post' THEN
        -- Recalculate from actual votes for accuracy
        PERFORM public.recalc_post_vote_counts(v_target_uuid);
        
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
        -- Recalculate from actual votes for accuracy
        PERFORM public.recalc_comment_vote_counts(v_target_uuid);
        
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
GRANT EXECUTE ON FUNCTION public.recalc_post_vote_counts(UUID) TO service_role, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.recalc_comment_vote_counts(UUID) TO service_role, authenticated, anon;

