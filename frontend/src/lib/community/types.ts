export interface CommunityPost {
  id: string;
  ticker: string;
  title: string;
  body: string;
  author_id: string;
  author_display: string | null;
  created_at: string;
  updated_at: string;
  score: number;
  upvotes?: number;
  downvotes?: number;
  comment_count: number;
  last_activity_at: string;
  is_deleted: boolean;
  user_vote?: number | null; // -1, 0, or 1
  attachments?: CommunityAttachment[];
}

export interface CommunityComment {
  id: string;
  post_id: string;
  parent_comment_id: string | null;
  depth: number;
  path: string;
  body: string;
  author_id: string;
  author_display: string | null;
  created_at: string;
  updated_at: string;
  score: number;
  upvotes?: number;
  downvotes?: number;
  is_deleted: boolean;
  user_vote?: number | null;
  attachments?: CommunityAttachment[];
  replies?: CommunityComment[]; // Nested replies
}

export interface CommunityAttachment {
  id: string;
  target_type: 'post' | 'comment';
  target_id: string;
  author_id: string;
  storage_path: string;
  mime: 'image/png' | 'image/jpeg';
  width: number | null;
  height: number | null;
  created_at: string;
  url?: string; // Signed URL
}

export interface CommunityVote {
  id: string;
  user_id: string;
  target_type: 'post' | 'comment';
  target_id: string;
  value: -1 | 1;
  created_at: string;
}

export type SortOption = 'hot' | 'new' | 'top';
export type TopTimeframe = '24h' | '7d' | 'all';

export interface ListPostsParams {
  ticker: string;
  sort: SortOption;
  timeframe?: TopTimeframe;
  cursor?: string;
  limit?: number;
}

export interface CreatePostParams {
  ticker: string;
  title: string;
  body: string;
  images?: File[];
}

export interface CreateCommentParams {
  post_id: string;
  parent_comment_id?: string | null;
  body: string;
  images?: File[];
}

export interface VoteParams {
  target_type: 'post' | 'comment';
  target_id: string;
  value: -1 | 1 | 0; // 0 means remove vote
}

