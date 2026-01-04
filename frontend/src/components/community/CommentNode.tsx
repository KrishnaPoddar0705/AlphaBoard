import { useState, useEffect } from 'react';
import { MessageSquare, Clock, Edit2, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { VoteRail } from './VoteRail';
import { ImageGrid } from './ImageGrid';
import { CommentComposer } from './CommentComposer';
import type { CommunityComment } from '@/lib/community/types';
import { formatDistanceToNow } from '@/lib/community/utils';
import { useUser } from '@clerk/clerk-react';
import { getSupabaseUserIdForClerkUser } from '@/lib/clerkSupabaseSync';

interface CommentNodeProps {
  comment: CommunityComment;
  depth: number;
  onVote: (commentId: string, value: -1 | 1 | 0) => Promise<void>;
  onReply: (parentId: string, body: string, images?: File[]) => Promise<void>;
  onEdit: (commentId: string, body: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  postId: string;
}

export function CommentNode({
  comment,
  depth,
  onVote,
  onReply,
  onEdit,
  onDelete,
  postId,
}: CommentNodeProps) {
  const { user } = useUser();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [isAuthor, setIsAuthor] = useState(false);
  const timeAgo = formatDistanceToNow(new Date(comment.created_at), { addSuffix: true });

  // Check if user is author by comparing Supabase user IDs
  useEffect(() => {
    const checkAuthor = async () => {
      if (user && comment) {
        const supabaseUserId = await getSupabaseUserIdForClerkUser(user.id);
        setIsAuthor(supabaseUserId === comment.author_id);
      } else {
        setIsAuthor(false);
      }
    };
    checkAuthor();
  }, [user?.id, comment.author_id]);
  const hasReplies = comment.replies && comment.replies.length > 0;
  const maxDepth = 6;

  const handleEdit = async () => {
    if (!editBody.trim()) return;
    try {
      await onEdit(comment.id, editBody);
      setIsEditing(false);
    } catch (error) {
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    try {
      await onDelete(comment.id);
    } catch (error) {
    }
  };

  if (comment.is_deleted) {
    return (
      <div className="flex gap-3 py-2" style={{ paddingLeft: `${depth * 24}px` }}>
        <div className="flex-1">
          <p className="text-sm font-mono text-[#6F6A60] italic">[deleted]</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-2">
      <div className="flex gap-3" style={{ paddingLeft: `${depth * 24}px` }}>
        {/* Vertical line for nesting */}
        {depth > 0 && (
          <div className="absolute left-0 top-0 bottom-0 w-px bg-[#E3DDCF]" />
        )}

        {/* Vote Rail */}
        <VoteRail
          score={comment.score}
          userVote={comment.user_vote}
          onVote={(value) => onVote(comment.id, value)}
        />

        {/* Comment Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-mono font-semibold text-[#1C1B17]">
              {comment.author_display || 'Anonymous'}
            </span>
            <span className="text-xs font-mono text-[#6F6A60] flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeAgo}
            </span>
            {hasReplies && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs font-mono text-[#6F6A60] hover:text-[#1C1B17] transition-colors flex items-center gap-1"
              >
                {isExpanded ? (
                  <>
                    <ChevronDown className="h-3 w-3" />
                    Hide {comment.replies?.length} {comment.replies?.length === 1 ? 'reply' : 'replies'}
                  </>
                ) : (
                  <>
                    <ChevronRight className="h-3 w-3" />
                    Show {comment.replies?.length} {comment.replies?.length === 1 ? 'reply' : 'replies'}
                  </>
                )}
              </button>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                className="w-full p-2 font-mono text-sm border border-[#D7D0C2] rounded bg-[#FBF7ED] text-[#1C1B17] focus:outline-none focus:ring-2 focus:ring-[#1C1B17]/20"
                rows={4}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleEdit}
                  className="px-3 py-1 text-xs font-mono bg-[#1C1B17] text-[#F7F2E6] rounded hover:bg-[#1C1B17]/90 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditBody(comment.body);
                  }}
                  className="px-3 py-1 text-xs font-mono border border-[#D7D0C2] rounded bg-[#F7F2E6] text-[#1C1B17] hover:bg-[#FBF7ED] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm font-mono text-[#1C1B17] whitespace-pre-wrap mb-2">
                {comment.body}
              </p>

              {/* Image Attachments */}
              {comment.attachments && comment.attachments.length > 0 && (
                <ImageGrid images={comment.attachments} maxDisplay={2} />
              )}

              {/* Actions */}
              <div className="flex items-center gap-4 mt-2">
                {depth < maxDepth && (
                  <button
                    onClick={() => setIsReplying(!isReplying)}
                    className="text-xs font-mono text-[#6F6A60] hover:text-[#1C1B17] transition-colors flex items-center gap-1"
                  >
                    <MessageSquare className="h-3 w-3" />
                    Reply
                  </button>
                )}
                {isAuthor && (
                  <>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="text-xs font-mono text-[#6F6A60] hover:text-[#1C1B17] transition-colors flex items-center gap-1"
                    >
                      <Edit2 className="h-3 w-3" />
                      Edit
                    </button>
                    <button
                      onClick={handleDelete}
                      className="text-xs font-mono text-[#B23B2A] hover:text-[#B23B2A]/80 transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </button>
                  </>
                )}
              </div>

              {/* Reply Composer */}
              {isReplying && (
                <div className="mt-3">
                  <CommentComposer
                    postId={postId}
                    parentCommentId={comment.id}
                    onSuccess={() => {
                      setIsReplying(false);
                    }}
                    onCancel={() => setIsReplying(false)}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Nested Replies */}
      {hasReplies && isExpanded && (
        <div className="relative">
          {comment.replies!.map((reply) => (
            <CommentNode
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              onVote={onVote}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              postId={postId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

