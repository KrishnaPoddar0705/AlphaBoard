import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { CommentNode } from './CommentNode';
import { CommentComposer } from './CommentComposer';
import { listComments, voteComment, updateComment, deleteComment, createComment } from '@/lib/community/api';
import type { CommunityComment } from '@/lib/community/types';

interface CommentTreeProps {
  postId: string;
}

export function CommentTree({ postId }: CommentTreeProps) {
  const { user } = useUser();
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(true);

  const loadComments = async () => {
    try {
      setLoading(true);
      const data = await listComments(postId, user?.id);
      setComments(data);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComments();
  }, [postId, user?.id]);

  const handleVote = async (commentId: string, value: -1 | 1 | 0) => {
    if (!user) return;
    try {
      const result = await voteComment(commentId, value, user.id);
      // Update the specific comment in state
      if (result) {
        const updateCommentInTree = (comments: CommunityComment[]): CommunityComment[] => {
          return comments.map(comment => {
            if (comment.id === commentId) {
              return {
                ...comment,
                score: result.score,
                upvotes: result.upvotes,
                downvotes: result.downvotes,
                user_vote: result.my_vote,
              };
            }
            if (comment.replies && comment.replies.length > 0) {
              return {
                ...comment,
                replies: updateCommentInTree(comment.replies),
              };
            }
            return comment;
          });
        };
        setComments(prev => updateCommentInTree(prev));
      } else {
        // Fallback: reload if no result
        await loadComments();
      }
    } catch (error) {
      // Reload on error to get correct state
      await loadComments();
    }
  };

  const handleReply = async (parentId: string, body: string, images?: File[]) => {
    if (!user) return;
    try {
      await createComment({
        post_id: postId,
        parent_comment_id: parentId,
        body,
        images,
        clerkUserId: user.id,
      });
      await loadComments();
    } catch (error) {
      throw error;
    }
  };

  const handleEdit = async (commentId: string, body: string) => {
    if (!user) return;
    try {
      await updateComment(commentId, { body });
      await loadComments();
    } catch (error) {
      throw error;
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!user) return;
    try {
      await deleteComment(commentId, user.id);
      await loadComments();
    } catch (error) {
      throw error;
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-b border-[#D7D0C2] pb-4">
        <h3 className="font-mono font-semibold text-[#1C1B17] mb-3">
          Comments ({comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0)})
        </h3>
        <CommentComposer
          postId={postId}
          onSuccess={loadComments}
        />
      </div>

      {loading ? (
        <div className="text-center py-8">
          <p className="font-mono text-[#6F6A60]">Loading comments...</p>
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 border border-[#D7D0C2] rounded bg-[#F7F2E6]">
          <p className="font-mono text-[#6F6A60]">No comments yet. Be the first to comment!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {comments.map((comment) => (
            <CommentNode
              key={comment.id}
              comment={comment}
              depth={0}
              onVote={handleVote}
              onReply={handleReply}
              onEdit={handleEdit}
              onDelete={handleDelete}
              postId={postId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

