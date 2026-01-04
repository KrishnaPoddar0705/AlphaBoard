import { supabase } from '../supabase';
import { getSupabaseUserIdForClerkUser } from '../clerkSupabaseSync';
import type {
  CommunityPost,
  CommunityComment,
  CommunityAttachment,
  ListPostsParams,
  CreatePostParams,
  CreateCommentParams,
} from './types';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_IMAGES_PER_POST = 4;
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];

/**
 * Validate image file
 */
function validateImage(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { valid: false, error: 'Only PNG and JPEG images are allowed' };
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return { valid: false, error: 'Image size must be less than 5MB' };
  }
  return { valid: true };
}

/**
 * Upload image to Supabase storage
 */
async function uploadImage(
  file: File,
  ticker: string,
  targetId: string,
  _targetType: 'post' | 'comment'
): Promise<string> {
  const validation = validateImage(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
  const storagePath = `${ticker}/${targetId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('community-images')
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload image: ${uploadError.message}`);
  }

  return storagePath;
}

/**
 * Get signed URL for image
 */
async function getImageUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('community-images')
    .createSignedUrl(storagePath, 3600); // 1 hour expiry

  if (error || !data) {
    throw new Error(`Failed to get image URL: ${error?.message}`);
  }

  return data.signedUrl;
}

/**
 * List posts for a ticker with sorting
 */
export async function listPosts(params: ListPostsParams & { clerkUserId?: string }): Promise<{
  posts: CommunityPost[];
  nextCursor?: string;
}> {
  const { ticker, sort, timeframe, cursor, limit = 20, clerkUserId } = params;

  let query = supabase
    .from('community_posts')
    .select('*')
    .eq('ticker', ticker)
    .eq('is_deleted', false)
    .limit(limit + 1); // Fetch one extra to determine if there's more

  // Apply sorting
  if (sort === 'hot') {
    query = query.order('last_activity_at', { ascending: false });
  } else if (sort === 'new') {
    query = query.order('created_at', { ascending: false });
  } else if (sort === 'top') {
    query = query.order('score', { ascending: false });

    // Apply timeframe filter for top
    if (timeframe === '24h') {
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);
      query = query.gte('created_at', yesterday.toISOString());
    } else if (timeframe === '7d') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      query = query.gte('created_at', weekAgo.toISOString());
    }
  }

  // Apply cursor pagination
  if (cursor) {
    const [timestamp, id] = cursor.split('|');
    if (sort === 'hot') {
      query = query.lt('last_activity_at', timestamp).or(`last_activity_at.eq.${timestamp},id.lt.${id}`);
    } else if (sort === 'new') {
      query = query.lt('created_at', timestamp).or(`created_at.eq.${timestamp},id.lt.${id}`);
    } else if (sort === 'top') {
      query = query.lt('score', parseInt(timestamp)).or(`score.eq.${timestamp},id.lt.${id}`);
    }
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch posts: ${error.message}`);
  }

  // Debug logging

  // Get current user's votes
  let userVotes: Record<string, number> = {};

  if (clerkUserId && data && data.length > 0) {
    const supabaseUserId = await getSupabaseUserIdForClerkUser(clerkUserId);
    if (supabaseUserId) {
      const postIds = data.map((p: any) => p.id);
      const { data: votes } = await supabase
        .from('community_votes')
        .select('target_id, value')
        .eq('user_id', supabaseUserId)
        .eq('target_type', 'post')
        .in('target_id', postIds);

      if (votes) {
        votes.forEach((v: any) => {
          userVotes[v.target_id] = v.value;
        });
      }
    }
  }

  // Process posts
  const posts: CommunityPost[] = [];
  const hasMore = data && data.length > limit;
  const postsToReturn = hasMore ? data.slice(0, limit) : (data || []);

  // Debug logging

  // Fetch attachments for all posts in batch
  const postIds = postsToReturn.map((p: any) => p.id);
  let attachmentsMap: Record<string, CommunityAttachment[]> = {};

  if (postIds.length > 0) {
    const { data: attachmentsData } = await supabase
      .from('community_attachments')
      .select('*')
      .eq('target_type', 'post')
      .in('target_id', postIds);

    if (attachmentsData) {
      for (const att of attachmentsData) {
        if (!attachmentsMap[att.target_id]) {
          attachmentsMap[att.target_id] = [];
        }
        try {
          const url = await getImageUrl(att.storage_path);
          attachmentsMap[att.target_id].push({
            ...att,
            url,
          });
        } catch (err) {
        }
      }
    }
  }

  for (const post of postsToReturn) {
    // Get user vote
    const userVote = userVotes[post.id] || null;

    // Get attachments for this post
    const attachments = attachmentsMap[post.id] || [];

    posts.push({
      ...post,
      user_vote: userVote,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
  }

  // Generate next cursor
  let nextCursor: string | undefined;
  if (hasMore && posts.length > 0) {
    const lastPost = posts[posts.length - 1];
    if (sort === 'hot') {
      nextCursor = `${lastPost.last_activity_at}|${lastPost.id}`;
    } else if (sort === 'new') {
      nextCursor = `${lastPost.created_at}|${lastPost.id}`;
    } else if (sort === 'top') {
      nextCursor = `${lastPost.score}|${lastPost.id}`;
    }
  }

  return { posts, nextCursor };
}

/**
 * Get a single post with full details
 */
export async function getPost(postId: string, clerkUserId?: string): Promise<CommunityPost> {
  const { data, error } = await supabase
    .from('community_posts')
    .select('*')
    .eq('id', postId)
    .eq('is_deleted', false)
    .single();

  if (error || !data) {
    throw new Error(`Failed to fetch post: ${error?.message}`);
  }

  // Get user vote
  let userVote: number | null = null;

  if (clerkUserId) {
    const supabaseUserId = await getSupabaseUserIdForClerkUser(clerkUserId);
    if (supabaseUserId) {
      const { data: vote } = await supabase
        .from('community_votes')
        .select('value')
        .eq('user_id', supabaseUserId)
        .eq('target_type', 'post')
        .eq('target_id', postId)
        .maybeSingle();

      userVote = vote?.value || null;
    }
  }

  // Fetch attachments separately (polymorphic relationship)
  const { data: attachmentsData } = await supabase
    .from('community_attachments')
    .select('*')
    .eq('target_type', 'post')
    .eq('target_id', postId);

  // Process attachments
  const attachments: CommunityAttachment[] = [];
  if (attachmentsData) {
    for (const att of attachmentsData) {
      try {
        const url = await getImageUrl(att.storage_path);
        attachments.push({
          ...att,
          url,
        });
      } catch (err) {
      }
    }
  }

  return {
    ...data,
    user_vote: userVote,
    attachments: attachments.length > 0 ? attachments : undefined,
  };
}

/**
 * Create a new post
 */
export async function createPost(params: CreatePostParams & { clerkUserId: string }): Promise<CommunityPost> {
  const { ticker, title, body, images = [], clerkUserId } = params;

  // Validate images
  if (images.length > MAX_IMAGES_PER_POST) {
    throw new Error(`Maximum ${MAX_IMAGES_PER_POST} images allowed per post`);
  }

  for (const img of images) {
    const validation = validateImage(img);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
  }

  // Get Supabase user ID from Clerk user ID
  const supabaseUserId = await getSupabaseUserIdForClerkUser(clerkUserId);
  if (!supabaseUserId) {
    throw new Error('User must be authenticated. Please ensure your account is synced.');
  }

  // Get user profile for display name
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', supabaseUserId)
    .maybeSingle();

  // Get email from clerk_user_mapping for fallback display name
  const { data: mapping } = await supabase
    .from('clerk_user_mapping')
    .select('email')
    .eq('clerk_user_id', clerkUserId)
    .maybeSingle();

  const authorDisplay = profile?.username || mapping?.email?.split('@')[0] || 'Anonymous';

  // Create post using RPC function to bypass RLS
  const { data: postData, error: postError } = await supabase.rpc('create_community_post', {
    p_author_id: supabaseUserId,
    p_ticker: ticker,
    p_title: title.trim(),
    p_body: body.trim(),
    p_author_display: authorDisplay,
  });

  if (postError || !postData) {
    throw new Error(`Failed to create post: ${postError?.message}`);
  }

  const post = postData as any;

  // Upload images and create attachments
  if (images.length > 0) {
    // const attachments = []; // Not used currently
    for (const img of images) {
      try {
        const storagePath = await uploadImage(img, ticker, post.id, 'post');

        // Get image dimensions (optional, can be done client-side)
        const imgElement = await new Promise<HTMLImageElement>((resolve, reject) => {
          const imgEl = new Image();
          // Create object URL from the file blob
          const objectUrl = URL.createObjectURL(img);
          imgEl.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(imgEl);
          };
          imgEl.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Failed to load image'));
          };
          imgEl.src = objectUrl;
        });

        const { error: attError } = await supabase.rpc('create_community_attachment', {
          p_author_id: supabaseUserId,
          p_target_type: 'post',
          p_target_id: post.id,
          p_storage_path: storagePath,
          p_mime: img.type as 'image/png' | 'image/jpeg',
          p_width: imgElement.width,
          p_height: imgElement.height,
        });

        if (attError) {
        }
      } catch (err) {
      }
    }
  }

  return getPost(post.id, clerkUserId);
}

/**
 * Update a post
 */
export async function updatePost(
  postId: string,
  updates: { title?: string; body?: string },
  clerkUserId: string
): Promise<CommunityPost> {
  const supabaseUserId = await getSupabaseUserIdForClerkUser(clerkUserId);
  if (!supabaseUserId) {
    throw new Error('User must be authenticated. Please ensure your account is synced.');
  }

  // Update post using RPC function to bypass RLS
  const { data: postData, error } = await supabase.rpc('update_community_post', {
    p_post_id: postId,
    p_author_id: supabaseUserId,
    p_title: updates.title !== undefined ? updates.title.trim() : null,
    p_body: updates.body !== undefined ? updates.body.trim() : null,
  });

  if (error || !postData) {
    throw new Error(`Failed to update post: ${error?.message}`);
  }

  return getPost(postId, clerkUserId);
}

/**
 * Soft delete a post
 */
export async function deletePost(postId: string, clerkUserId: string): Promise<void> {
  const supabaseUserId = await getSupabaseUserIdForClerkUser(clerkUserId);
  if (!supabaseUserId) {
    throw new Error('User must be authenticated. Please ensure your account is synced.');
  }

  // Delete post using RPC function to bypass RLS
  const { error } = await supabase.rpc('delete_community_post', {
    p_post_id: postId,
    p_author_id: supabaseUserId,
  });

  if (error) {
    throw new Error(`Failed to delete post: ${error.message}`);
  }
}

/**
 * Vote on a post - returns updated vote counts
 */
export async function votePost(
  postId: string,
  value: -1 | 1 | 0,
  _clerkUserId: string
): Promise<{ score: number; upvotes: number; downvotes: number; my_vote: number | null }> {
  // Import ensureVoterSession dynamically to avoid circular dependencies
  const { ensureVoterSession } = await import('@/lib/auth/ensureVoterSession');

  // Ensure we have a Supabase session (creates anonymous session if needed)
  const hasSession = await ensureVoterSession();
  if (!hasSession) {
    throw new Error('Failed to establish voting session');
  }

  // Convert 0 to null for removing vote
  const newValue = value === 0 ? null : value;

  // Vote using new RPC function (uses auth.uid() from JWT)
  const { data, error } = await supabase.rpc('rpc_cast_vote', {
    p_target_type: 'post',
    p_target_id: postId,
    p_new_value: newValue,
  });

  if (error) {
    throw new Error(`Failed to vote: ${error.message}`);
  }

  if (!data) {
    throw new Error('No data returned from vote');
  }

  return {
    score: data.score,
    upvotes: data.upvotes,
    downvotes: data.downvotes,
    my_vote: data.my_vote,
  };
}

/**
 * List comments for a post (builds nested tree)
 */
export async function listComments(postId: string, clerkUserId?: string): Promise<CommunityComment[]> {
  const { data, error } = await supabase
    .from('community_comments')
    .select('*')
    .eq('post_id', postId)
    .eq('is_deleted', false)
    .order('path', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch comments: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Get user votes
  let userVotes: Record<string, number> = {};

  if (clerkUserId) {
    const supabaseUserId = await getSupabaseUserIdForClerkUser(clerkUserId);
    if (supabaseUserId) {
      const commentIds = data.map((c: any) => c.id);
      const { data: votes } = await supabase
        .from('community_votes')
        .select('target_id, value')
        .eq('user_id', supabaseUserId)
        .eq('target_type', 'comment')
        .in('target_id', commentIds);

      if (votes) {
        votes.forEach((v: any) => {
          userVotes[v.target_id] = v.value;
        });
      }
    }
  }

  // Fetch attachments for all comments in batch
  const commentIds = data.map((c: any) => c.id);
  let attachmentsMap: Record<string, CommunityAttachment[]> = {};

  if (commentIds.length > 0) {
    const { data: attachmentsData } = await supabase
      .from('community_attachments')
      .select('*')
      .eq('target_type', 'comment')
      .in('target_id', commentIds);

    if (attachmentsData) {
      for (const att of attachmentsData) {
        if (!attachmentsMap[att.target_id]) {
          attachmentsMap[att.target_id] = [];
        }
        try {
          const url = await getImageUrl(att.storage_path);
          attachmentsMap[att.target_id].push({
            ...att,
            url,
          });
        } catch (err) {
        }
      }
    }
  }

  // Process attachments and build tree
  const commentMap = new Map<string, CommunityComment>();
  const rootComments: CommunityComment[] = [];

  for (const comment of data) {
    // Get user vote
    const userVote = userVotes[comment.id] || null;

    // Get attachments for this comment
    const attachments = attachmentsMap[comment.id] || [];

    const processedComment: CommunityComment = {
      ...comment,
      user_vote: userVote,
      attachments: attachments.length > 0 ? attachments : undefined,
      replies: [],
    };

    commentMap.set(comment.id, processedComment);

    if (comment.parent_comment_id) {
      const parent = commentMap.get(comment.parent_comment_id);
      if (parent) {
        if (!parent.replies) {
          parent.replies = [];
        }
        parent.replies.push(processedComment);
      }
    } else {
      rootComments.push(processedComment);
    }
  }

  return rootComments;
}

/**
 * Create a comment
 */
export async function createComment(params: CreateCommentParams & { clerkUserId: string }): Promise<CommunityComment> {
  const { post_id, parent_comment_id, body, images = [], clerkUserId } = params;

  // Validate images
  if (images.length > MAX_IMAGES_PER_POST) {
    throw new Error(`Maximum ${MAX_IMAGES_PER_POST} images allowed per comment`);
  }

  for (const img of images) {
    const validation = validateImage(img);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
  }

  // Get Supabase user ID from Clerk user ID
  const supabaseUserId = await getSupabaseUserIdForClerkUser(clerkUserId);
  if (!supabaseUserId) {
    throw new Error('User must be authenticated. Please ensure your account is synced.');
  }

  // Get post ticker
  const { data: post } = await supabase
    .from('community_posts')
    .select('ticker')
    .eq('id', post_id)
    .single();

  if (!post) {
    throw new Error('Post not found');
  }

  // Calculate depth and path
  let depth = 0;
  let path = '';

  if (parent_comment_id) {
    const { data: parent } = await supabase
      .from('community_comments')
      .select('depth, path')
      .eq('id', parent_comment_id)
      .single();

    if (!parent) {
      throw new Error('Parent comment not found');
    }

    if (parent.depth >= 6) {
      throw new Error('Maximum comment depth reached');
    }

    depth = parent.depth + 1;

    // Generate path (simplified - in production, use the SQL function)
    const { data: siblings } = await supabase
      .from('community_comments')
      .select('path')
      .eq('post_id', post_id)
      .eq('parent_comment_id', parent_comment_id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (siblings && siblings.length > 0) {
      const lastPath = siblings[0].path;
      const parts = lastPath.split('.');
      const lastPart = parseInt(parts[parts.length - 1]);
      const newPart = String(lastPart + 1).padStart(4, '0');
      path = parent.path + '.' + newPart;
    } else {
      path = parent.path + '.0001';
    }
  } else {
    // Root level comment
    const { data: siblings } = await supabase
      .from('community_comments')
      .select('path')
      .eq('post_id', post_id)
      .is('parent_comment_id', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (siblings && siblings.length > 0) {
      const lastPath = siblings[0].path;
      const lastPart = parseInt(lastPath);
      const newPart = String(lastPart + 1).padStart(4, '0');
      path = newPart;
    } else {
      path = '0001';
    }
  }

  // Get user profile for display name
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', supabaseUserId)
    .maybeSingle();

  // Get email from clerk_user_mapping for fallback display name
  const { data: mapping } = await supabase
    .from('clerk_user_mapping')
    .select('email')
    .eq('clerk_user_id', clerkUserId)
    .maybeSingle();

  const authorDisplay = profile?.username || mapping?.email?.split('@')[0] || 'Anonymous';

  // Create comment using RPC function to bypass RLS
  const { data: commentData, error: commentError } = await supabase.rpc('create_community_comment', {
    p_author_id: supabaseUserId,
    p_post_id: post_id,
    p_body: body.trim(),
    p_parent_comment_id: parent_comment_id || null,
    p_author_display: authorDisplay,
    p_depth: depth,
    p_path: path || null,
  });

  if (commentError || !commentData) {
    throw new Error(`Failed to create comment: ${commentError?.message}`);
  }

  const comment = commentData as any;

  // Upload images and create attachments
  if (images.length > 0) {
    for (const img of images) {
      try {
        const storagePath = await uploadImage(img, post.ticker, comment.id, 'comment');

        const imgElement = await new Promise<HTMLImageElement>((resolve, reject) => {
          const imgEl = new Image();
          imgEl.onload = () => resolve(imgEl);
          imgEl.onerror = reject;
          imgEl.src = URL.createObjectURL(img);
        });

        const { error: attError } = await supabase.rpc('create_community_attachment', {
          p_author_id: supabaseUserId,
          p_target_type: 'comment',
          p_target_id: comment.id,
          p_storage_path: storagePath,
          p_mime: img.type as 'image/png' | 'image/jpeg',
          p_width: imgElement.width,
          p_height: imgElement.height,
        });

        if (attError) {
        }
      } catch (err) {
      }
    }
  }

  // Fetch and return the comment with attachments
  return listComments(post_id, clerkUserId).then(comments => {
    // Find the comment in the tree
    const findComment = (comments: CommunityComment[]): CommunityComment | null => {
      for (const c of comments) {
        if (c.id === comment.id) return c;
        if (c.replies) {
          const found = findComment(c.replies);
          if (found) return found;
        }
      }
      return null;
    };
    return findComment(comments) || comment as CommunityComment;
  });
}

/**
 * Update a comment
 */
export async function updateComment(
  commentId: string,
  updates: { body: string }
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User must be authenticated');
  }

  const { error } = await supabase
    .from('community_comments')
    .update({ body: updates.body.trim() })
    .eq('id', commentId)
    .eq('author_id', user.id);

  if (error) {
    throw new Error(`Failed to update comment: ${error.message}`);
  }
}

/**
 * Soft delete a comment
 */
export async function deleteComment(commentId: string, clerkUserId: string): Promise<void> {
  const supabaseUserId = await getSupabaseUserIdForClerkUser(clerkUserId);
  if (!supabaseUserId) {
    throw new Error('User must be authenticated. Please ensure your account is synced.');
  }

  // Delete comment using RPC function to bypass RLS
  const { error } = await supabase.rpc('delete_community_comment', {
    p_comment_id: commentId,
    p_author_id: supabaseUserId,
  });

  if (error) {
    throw new Error(`Failed to delete comment: ${error.message}`);
  }
}

/**
 * Vote on a comment - returns updated vote counts
 */
export async function voteComment(
  commentId: string,
  value: -1 | 1 | 0,
  _clerkUserId: string
): Promise<{ score: number; upvotes: number; downvotes: number; my_vote: number | null }> {
  // Import ensureVoterSession dynamically to avoid circular dependencies
  const { ensureVoterSession } = await import('@/lib/auth/ensureVoterSession');

  // Ensure we have a Supabase session (creates anonymous session if needed)
  const hasSession = await ensureVoterSession();
  if (!hasSession) {
    throw new Error('Failed to establish voting session');
  }

  // Convert 0 to null for removing vote
  const newValue = value === 0 ? null : value;

  // Vote using new RPC function (uses auth.uid() from JWT)
  const { data, error } = await supabase.rpc('rpc_cast_vote', {
    p_target_type: 'comment',
    p_target_id: commentId,
    p_new_value: newValue,
  });

  if (error) {
    throw new Error(`Failed to vote: ${error.message}`);
  }

  if (!data) {
    throw new Error('No data returned from vote');
  }

  return {
    score: data.score,
    upvotes: data.upvotes,
    downvotes: data.downvotes,
    my_vote: data.my_vote,
  };
}

