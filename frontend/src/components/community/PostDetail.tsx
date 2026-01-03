import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, MessageSquare, Edit2, Trash2 } from 'lucide-react';
import { useUser } from '@clerk/clerk-react';
import { getPost, votePost, updatePost, deletePost } from '@/lib/community/api';
import { getSupabaseUserIdForClerkUser } from '@/lib/clerkSupabaseSync';
import { VoteRail } from './VoteRail';
import { ImageGrid } from './ImageGrid';
import { CommentTree } from './CommentTree';
import { formatDistanceToNow } from '@/lib/community/utils';
import type { CommunityPost } from '@/lib/community/types';

export function PostDetail() {
  const { ticker, postId } = useParams<{ ticker: string; postId: string }>();
  const navigate = useNavigate();
  const { user } = useUser();
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [isAuthor, setIsAuthor] = useState(false);

  const loadPost = async () => {
    try {
      setLoading(true);
      const data = await getPost(postId!, user?.id);
      setPost(data);
      setEditTitle(data.title);
      setEditBody(data.body);
    } catch (error) {
      console.error('Failed to load post:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (postId) {
      loadPost();
    }
  }, [postId, user?.id]);

  // Check if user is author by comparing Supabase user IDs
  useEffect(() => {
    const checkAuthor = async () => {
      if (user && post) {
        const supabaseUserId = await getSupabaseUserIdForClerkUser(user.id);
        setIsAuthor(supabaseUserId === post.author_id);
      } else {
        setIsAuthor(false);
      }
    };
    checkAuthor();
  }, [user?.id, post?.author_id]);

  const handleVote = async (value: -1 | 1 | 0) => {
    if (!post || !user) return;
    try {
      await votePost(post.id, value, user.id);
      await loadPost(); // Reload to get updated score
    } catch (error) {
      console.error('Failed to vote:', error);
    }
  };

  const handleEdit = async () => {
    if (!post || !editTitle.trim() || !editBody.trim() || !user) return;
    try {
      await updatePost(post.id, {
        title: editTitle.trim(),
        body: editBody.trim(),
      }, user.id);
      setIsEditing(false);
      await loadPost();
    } catch (error) {
      console.error('Failed to edit post:', error);
    }
  };

  const handleDelete = async () => {
    if (!post || !user || !confirm('Are you sure you want to delete this post?')) return;
    try {
      await deletePost(post.id, user.id);
      // Navigate back to community
      navigate(`/stock/${ticker}/community`);
    } catch (error) {
      console.error('Failed to delete post:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="font-mono text-[#6F6A60]">Loading post...</p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="font-mono text-[#6F6A60]">Post not found</p>
      </div>
    );
  }

  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Breadcrumb */}
        <button
          onClick={() => navigate(`/stock/${ticker}/community`)}
          className="inline-flex items-center gap-2 text-sm font-mono text-[#6F6A60] hover:text-[#1C1B17] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {ticker} Community
        </button>

        {/* Post */}
        <div className="flex gap-4 border border-[#D7D0C2] rounded bg-[#F7F2E6] p-6">
          <VoteRail
            score={post.score}
            userVote={post.user_vote}
            onVote={handleVote}
          />

          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="space-y-4">
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full p-2 font-mono font-semibold text-lg border border-[#D7D0C2] rounded bg-[#FBF7ED] text-[#1C1B17] focus:outline-none focus:ring-2 focus:ring-[#1C1B17]/20"
                  maxLength={120}
                />
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  className="w-full p-2 font-mono text-sm border border-[#D7D0C2] rounded bg-[#FBF7ED] text-[#1C1B17] focus:outline-none focus:ring-2 focus:ring-[#1C1B17]/20"
                  rows={10}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleEdit}
                    className="px-4 py-2 text-sm font-mono bg-[#1C1B17] text-[#F7F2E6] rounded hover:bg-[#1C1B17]/90 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditTitle(post.title);
                      setEditBody(post.body);
                    }}
                    className="px-4 py-2 text-sm font-mono border border-[#D7D0C2] rounded bg-[#F7F2E6] text-[#1C1B17] hover:bg-[#FBF7ED] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="font-mono font-bold text-2xl text-[#1C1B17] mb-3">
                  {post.title}
                </h1>

                <div className="flex items-center gap-2 mb-4 text-sm font-mono text-[#6F6A60]">
                  <span>by {post.author_display || 'Anonymous'}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {timeAgo}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {post.comment_count} {post.comment_count === 1 ? 'comment' : 'comments'}
                  </span>
                  {isAuthor && (
                    <>
                      <span>•</span>
                      <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-1 hover:text-[#1C1B17] transition-colors"
                      >
                        <Edit2 className="h-3 w-3" />
                        Edit
                      </button>
                      <span>•</span>
                      <button
                        onClick={handleDelete}
                        className="flex items-center gap-1 text-[#B23B2A] hover:text-[#B23B2A]/80 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </button>
                    </>
                  )}
                </div>

                <div className="prose prose-sm max-w-none mb-4">
                  <p className="font-mono text-[#1C1B17] whitespace-pre-wrap">
                    {post.body}
                  </p>
                </div>

                {/* Images */}
                {post.attachments && post.attachments.length > 0 && (
                  <ImageGrid images={post.attachments} maxDisplay={10} />
                )}
              </>
            )}
          </div>
        </div>

        {/* Comments */}
        <CommentTree postId={post.id} />
      </div>
    </div>
  );
}

