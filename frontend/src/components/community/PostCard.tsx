import { Link } from 'react-router-dom';
import { MessageSquare, Clock } from 'lucide-react';
import { VoteRail } from './VoteRail';
import { ImageGrid } from './ImageGrid';
import type { CommunityPost } from '@/lib/community/types';
import { formatDistanceToNow } from '@/lib/community/utils';

interface PostCardProps {
  post: CommunityPost;
  onVote: (value: -1 | 1 | 0) => Promise<void>;
  ticker: string;
}

export function PostCard({ post, onVote, ticker }: PostCardProps) {
  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });
  const bodyPreview = post.body.length > 200 
    ? post.body.substring(0, 200) + '...' 
    : post.body;

  return (
    <div className="flex gap-3 p-4 border-b border-[#D7D0C2] bg-[#F7F2E6] hover:bg-[#FBF7ED] transition-colors">
      {/* Vote Rail */}
      <VoteRail
        score={post.score}
        userVote={post.user_vote}
        onVote={onVote}
      />

      {/* Post Content */}
      <div className="flex-1 min-w-0">
          <Link
            to={`/stock/${ticker}/community/${post.id}`}
            className="block group"
          >
          <h3 className="font-mono font-semibold text-[#1C1B17] mb-1 group-hover:text-[#1C1B17]/80 transition-colors">
            {post.title}
          </h3>
          
          <div className="text-sm font-mono text-[#6F6A60] mb-2 flex items-center gap-2">
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
          </div>

          <p className="text-sm font-mono text-[#1C1B17] mb-2 whitespace-pre-wrap">
            {bodyPreview}
          </p>
        </Link>

        {/* Image Preview */}
        {post.attachments && post.attachments.length > 0 && (
          <ImageGrid images={post.attachments} maxDisplay={2} />
        )}

        {/* Actions */}
        <div className="flex items-center gap-4 mt-3">
          <Link
            to={`/stock/${ticker}/community/${post.id}`}
            className="text-sm font-mono text-[#6F6A60] hover:text-[#1C1B17] transition-colors flex items-center gap-1"
          >
            <MessageSquare className="h-4 w-4" />
            Comment
          </Link>
        </div>
      </div>
    </div>
  );
}

