-- Migration: Add SECURITY DEFINER functions for community forum operations
-- Purpose: Allow frontend to create/update/delete posts and comments using Supabase user ID
-- Since Clerk auth doesn't set auth.uid(), we need SECURITY DEFINER functions

-- ============================================================================
-- 1. CREATE POST FUNCTION
-- ============================================================================

DROP FUNCTION IF EXISTS public.create_community_post(
  uuid, text, text, text, text
);

CREATE FUNCTION public.create_community_post(
  p_author_id uuid,
  p_ticker text,
  p_title text,
  p_body text,
  p_author_display text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_id uuid;
  post_data jsonb;
BEGIN
  INSERT INTO public.community_posts (
    ticker,
    title,
    body,
    author_id,
    author_display
  ) VALUES (
    p_ticker,
    p_title,
    p_body,
    p_author_id,
    COALESCE(p_author_display, 'Anonymous')
  )
  RETURNING id INTO post_id;
  
  -- Return the full record as JSONB
  SELECT row_to_json(p.*)::jsonb INTO post_data
  FROM public.community_posts p
  WHERE p.id = post_id;
  
  RETURN post_data;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_community_post(
  uuid, text, text, text, text
) TO authenticated, anon, service_role;

-- ============================================================================
-- 2. UPDATE POST FUNCTION
-- ============================================================================

DROP FUNCTION IF EXISTS public.update_community_post(
  uuid, uuid, text, text
);

CREATE FUNCTION public.update_community_post(
  p_post_id uuid,
  p_author_id uuid,
  p_title text DEFAULT NULL,
  p_body text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_data jsonb;
BEGIN
  UPDATE public.community_posts
  SET 
    title = COALESCE(p_title, title),
    body = COALESCE(p_body, body),
    updated_at = NOW()
  WHERE id = p_post_id
    AND author_id = p_author_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post not found or user is not the author';
  END IF;
  
  -- Return the updated record
  SELECT row_to_json(p.*)::jsonb INTO post_data
  FROM public.community_posts p
  WHERE p.id = p_post_id;
  
  RETURN post_data;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_community_post(
  uuid, uuid, text, text
) TO authenticated, anon, service_role;

-- ============================================================================
-- 3. DELETE POST FUNCTION
-- ============================================================================

DROP FUNCTION IF EXISTS public.delete_community_post(
  uuid, uuid
);

CREATE FUNCTION public.delete_community_post(
  p_post_id uuid,
  p_author_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.community_posts
  SET is_deleted = true,
      updated_at = NOW()
  WHERE id = p_post_id
    AND author_id = p_author_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post not found or user is not the author';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_community_post(
  uuid, uuid
) TO authenticated, anon, service_role;

-- ============================================================================
-- 4. VOTE ON POST FUNCTION
-- ============================================================================

DROP FUNCTION IF EXISTS public.vote_community_post(
  uuid, uuid, integer
);

CREATE FUNCTION public.vote_community_post(
  p_post_id uuid,
  p_user_id uuid,
  p_value integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_value = 0 THEN
    -- Remove vote
    DELETE FROM public.community_votes
    WHERE target_type = 'post'
      AND target_id = p_post_id
      AND user_id = p_user_id;
  ELSE
    -- Upsert vote
    INSERT INTO public.community_votes (
      user_id,
      target_type,
      target_id,
      value
    ) VALUES (
      p_user_id,
      'post',
      p_post_id,
      p_value
    )
    ON CONFLICT (user_id, target_type, target_id)
    DO UPDATE SET value = p_value;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.vote_community_post(
  uuid, uuid, integer
) TO authenticated, anon, service_role;

-- ============================================================================
-- 5. CREATE COMMENT FUNCTION
-- ============================================================================

DROP FUNCTION IF EXISTS public.create_community_comment(
  uuid, uuid, uuid, text, text, integer, text, text
);

CREATE FUNCTION public.create_community_comment(
  p_author_id uuid,
  p_post_id uuid,
  p_body text,
  p_parent_comment_id uuid DEFAULT NULL,
  p_author_display text DEFAULT NULL,
  p_depth integer DEFAULT 0,
  p_path text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comment_id uuid;
  comment_data jsonb;
BEGIN
  INSERT INTO public.community_comments (
    post_id,
    parent_comment_id,
    depth,
    path,
    body,
    author_id,
    author_display
  ) VALUES (
    p_post_id,
    p_parent_comment_id,
    p_depth,
    COALESCE(p_path, '0001'),
    p_body,
    p_author_id,
    COALESCE(p_author_display, 'Anonymous')
  )
  RETURNING id INTO comment_id;
  
  -- Return the full record as JSONB
  SELECT row_to_json(c.*)::jsonb INTO comment_data
  FROM public.community_comments c
  WHERE c.id = comment_id;
  
  RETURN comment_data;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_community_comment(
  uuid, uuid, text, uuid, text, integer, text
) TO authenticated, anon, service_role;

-- ============================================================================
-- 6. UPDATE COMMENT FUNCTION
-- ============================================================================

DROP FUNCTION IF EXISTS public.update_community_comment(
  uuid, uuid, text
);

CREATE FUNCTION public.update_community_comment(
  p_comment_id uuid,
  p_author_id uuid,
  p_body text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comment_data jsonb;
BEGIN
  UPDATE public.community_comments
  SET 
    body = p_body,
    updated_at = NOW()
  WHERE id = p_comment_id
    AND author_id = p_author_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comment not found or user is not the author';
  END IF;
  
  -- Return the updated record
  SELECT row_to_json(c.*)::jsonb INTO comment_data
  FROM public.community_comments c
  WHERE c.id = p_comment_id;
  
  RETURN comment_data;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_community_comment(
  uuid, uuid, text
) TO authenticated, anon, service_role;

-- ============================================================================
-- 7. DELETE COMMENT FUNCTION
-- ============================================================================

DROP FUNCTION IF EXISTS public.delete_community_comment(
  uuid, uuid
);

CREATE FUNCTION public.delete_community_comment(
  p_comment_id uuid,
  p_author_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.community_comments
  SET is_deleted = true,
      updated_at = NOW()
  WHERE id = p_comment_id
    AND author_id = p_author_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comment not found or user is not the author';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_community_comment(
  uuid, uuid
) TO authenticated, anon, service_role;

-- ============================================================================
-- 8. VOTE ON COMMENT FUNCTION
-- ============================================================================

DROP FUNCTION IF EXISTS public.vote_community_comment(
  uuid, uuid, integer
);

CREATE FUNCTION public.vote_community_comment(
  p_comment_id uuid,
  p_user_id uuid,
  p_value integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_value = 0 THEN
    -- Remove vote
    DELETE FROM public.community_votes
    WHERE target_type = 'comment'
      AND target_id = p_comment_id
      AND user_id = p_user_id;
  ELSE
    -- Upsert vote
    INSERT INTO public.community_votes (
      user_id,
      target_type,
      target_id,
      value
    ) VALUES (
      p_user_id,
      'comment',
      p_comment_id,
      p_value
    )
    ON CONFLICT (user_id, target_type, target_id)
    DO UPDATE SET value = p_value;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.vote_community_comment(
  uuid, uuid, integer
) TO authenticated, anon, service_role;

-- ============================================================================
-- 9. CREATE ATTACHMENT FUNCTION
-- ============================================================================

DROP FUNCTION IF EXISTS public.create_community_attachment(
  uuid, text, uuid, text, text, integer, integer
);

CREATE FUNCTION public.create_community_attachment(
  p_author_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_storage_path text,
  p_mime text,
  p_width integer DEFAULT NULL,
  p_height integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  attachment_id uuid;
  attachment_data jsonb;
BEGIN
  INSERT INTO public.community_attachments (
    target_type,
    target_id,
    author_id,
    storage_path,
    mime,
    width,
    height
  ) VALUES (
    p_target_type,
    p_target_id,
    p_author_id,
    p_storage_path,
    p_mime,
    p_width,
    p_height
  )
  RETURNING id INTO attachment_id;
  
  -- Return the full record as JSONB
  SELECT row_to_json(a.*)::jsonb INTO attachment_data
  FROM public.community_attachments a
  WHERE a.id = attachment_id;
  
  RETURN attachment_data;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_community_attachment(
  uuid, text, uuid, text, text, integer, integer
) TO authenticated, anon, service_role;

-- Verify functions were created
SELECT proname, prosecdef 
FROM pg_proc 
WHERE proname LIKE 'create_community%' 
   OR proname LIKE 'update_community%'
   OR proname LIKE 'delete_community%'
   OR proname LIKE 'vote_community%'
ORDER BY proname;

