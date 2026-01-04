import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { ImageGrid } from './ImageGrid';
import { CommunityActionStrip } from './CommunityActionStrip';
import type { CommunityPost } from '@/lib/community/types';
import { formatDistanceToNow } from '@/lib/community/utils';

interface PostCardProps {
  post: CommunityPost;
  ticker: string;
}

export function PostCard({ post, ticker }: PostCardProps) {
  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });
  const bodyPreview = post.body.length > 200 
    ? post.body.substring(0, 200) + '...' 
    : post.body;

  return (
    <div className="flex gap-3 p-4 border-b border-[#D7D0C2] bg-[#F7F2E6] hover:bg-[#FBF7ED] transition-colors">
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
          </div>

          <p className="text-sm font-mono text-[#1C1B17] mb-2 whitespace-pre-wrap">
            {bodyPreview}
          </p>
        </Link>

        {/* Image Preview */}
        {post.attachments && post.attachments.length > 0 && (
          <ImageGrid images={post.attachments} maxDisplay={2} />
        )}

        {/* Action Strip */}
        <div className="flex items-center gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
          <CommunityActionStrip
            variant="post"
            targetType="post"
            targetId={post.id}
            ticker={ticker}
            score={post.score}
            upvotes={post.upvotes ?? 0}
            downvotes={post.downvotes ?? 0}
            myVote={post.user_vote ?? null}
            commentCount={post.comment_count}
          />
        </div>
      </div>
    </div>
  );
}

