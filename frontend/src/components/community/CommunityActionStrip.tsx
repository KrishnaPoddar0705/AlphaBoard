/**
 * CommunityActionStrip - Unified action row for votes, comments, and threads
 * Paper terminal theme with clean, professional design
 */

// import { Button } from '@/components/ui/button'; // Unused
import { ArrowUp, ArrowDown, MessageSquare, Landmark } from 'lucide-react';
import { useVote, type VoteTargetType } from '@/hooks/useVote';
import { useNavigate } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import * as React from 'react';

interface CommunityActionStripProps {
  variant: 'stock' | 'post' | 'comment';
  targetType: VoteTargetType;
  targetId: string; // UUID for posts/comments, ticker string for stocks
  ticker: string; // For thread icon mapping and navigation
  score: number;
  upvotes: number;
  downvotes: number;
  myVote?: number | null;
  commentCount: number;
  threadCount?: number; // Only for stock variant
  onCommentClick?: () => void;
  onThreadClick?: () => void;
  onVote?: () => void; // Callback after vote is cast
  className?: string;
}

export function CommunityActionStrip({
  variant,
  targetType,
  targetId,
  ticker,
  score,
  upvotes,
  downvotes,
  myVote = null,
  commentCount,
  threadCount = 0,
  onCommentClick,
  onThreadClick,
  onVote,
  className = '',
}: CommunityActionStripProps) {
  const navigate = useNavigate();
  const lastVoteRef = React.useRef<number | null>(myVote);
  const updateCountRef = React.useRef(0);
  
  // Sync lastVoteRef when myVote prop changes (e.g., on page reload)
  React.useEffect(() => {
    if (lastVoteRef.current !== myVote) {
      lastVoteRef.current = myVote;
      // Reset update count when myVote changes from external source (page reload)
      updateCountRef.current = 0;
    }
  }, [myVote]);
  
  const {
    score: currentScore,
    myVote: currentMyVote,
    isVoting,
    castVote,
  } = useVote({
    targetType,
    targetId,
    initialScore: score,
    initialUpvotes: upvotes,
    initialDownvotes: downvotes,
    initialMyVote: myVote,
    onUpdate: (updatedState) => {
      // onUpdate is called twice: once optimistically, once after server response
      // We only want to refetch after the server response (second call)
      updateCountRef.current += 1;
      
      // Only refetch after server response (second update call) and if vote changed
      if (onVote && updateCountRef.current === 2 && updatedState.myVote !== lastVoteRef.current) {
        lastVoteRef.current = updatedState.myVote;
        updateCountRef.current = 0; // Reset for next vote
        // Small delay to ensure DB update is complete
        setTimeout(() => {
          onVote();
        }, 500);
      } else if (updateCountRef.current >= 2) {
        // Reset counter if we've processed both updates
        updateCountRef.current = 0;
      }
    },
  });

  // Always use Landmark icon for threads
  const ThreadIcon = Landmark;

  const handleCommentClick = () => {
    if (onCommentClick) {
      onCommentClick();
    } else if (variant === 'stock') {
      navigate(`/stock/${ticker}/community`);
    } else if (variant === 'post') {
      navigate(`/stock/${ticker}/community/${targetId}`);
    }
  };

  const handleThreadClick = () => {
    if (onThreadClick) {
      onThreadClick();
    } else if (variant === 'stock') {
      navigate(`/stock/${ticker}/community`);
    }
  };

  const isUpvoted = currentMyVote === 1;
  const isDownvoted = currentMyVote === -1;

  return (
    <TooltipProvider>
      <div
        className={`
          flex items-center gap-0 border border-[#D7D0C2] rounded-md bg-[#F7F2E6] overflow-hidden
          h-[34px] px-0
          ${className}
        `}
      >
        {/* Section 1: Vote Control */}
        <div
          className={`
            flex items-center gap-0 border-r border-[#D7D0C2] last:border-r-0
            ${isUpvoted ? 'bg-[rgba(47,143,91,0.12)]' : ''}
            ${isDownvoted ? 'bg-[rgba(178,59,42,0.12)]' : ''}
          `}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => castVote('up')}
                disabled={isVoting}
                className={`
                  h-[34px] px-2 flex items-center justify-center
                  hover:bg-[rgba(28,27,23,0.04)] transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${isUpvoted ? 'bg-[rgba(47,143,91,0.2)]' : ''}
                `}
                aria-label="Upvote"
              >
                <ArrowUp
                  className={`h-[16px] w-[16px] ${
                    isUpvoted ? 'text-[#2F8F5B]' : 'text-[#6F6A60]'
                  }`}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-mono text-xs">Upvote</p>
            </TooltipContent>
          </Tooltip>

          <span
            className={`
              text-xs font-mono tabular-nums px-2 min-w-[32px] text-center
              ${currentScore > 0 ? 'text-[#2F8F5B]' : currentScore < 0 ? 'text-[#B23B2A]' : 'text-[#1C1B17]'}
            `}
          >
            {currentScore}
          </span>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => castVote('down')}
                disabled={isVoting}
                className={`
                  h-[34px] px-2 flex items-center justify-center
                  hover:bg-[rgba(28,27,23,0.04)] transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${isDownvoted ? 'bg-[rgba(178,59,42,0.2)]' : ''}
                `}
                aria-label="Downvote"
              >
                <ArrowDown
                  className={`h-[16px] w-[16px] ${
                    isDownvoted ? 'text-[#B23B2A]' : 'text-[#6F6A60]'
                  }`}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-mono text-xs">Downvote</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Section 2: Comment Count */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleCommentClick}
              className="h-[34px] px-2 flex items-center gap-1.5 hover:bg-[rgba(28,27,23,0.04)] transition-colors border-r border-[#D7D0C2] last:border-r-0"
            >
              <MessageSquare className="h-[16px] w-[16px] text-[#6F6A60]" />
              <span className="text-xs font-mono tabular-nums text-[#1C1B17]">
                {commentCount}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-mono text-xs">Comments</p>
          </TooltipContent>
        </Tooltip>

        {/* Section 3: Threads (only for stock variant) */}
        {variant === 'stock' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleThreadClick}
                className="h-[34px] px-2 flex items-center gap-1.5 hover:bg-[rgba(28,27,23,0.04)] transition-colors"
              >
                <ThreadIcon className="h-[16px] w-[16px] text-[#6F6A60]" />
                <span className="text-xs font-mono tabular-nums text-[#1C1B17]">
                  {threadCount}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-mono text-xs">Threads</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* For post variant, show thread icon linking to post detail */}
        {variant === 'post' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleCommentClick}
                className="h-[34px] px-2 flex items-center gap-1.5 hover:bg-[rgba(28,27,23,0.04)] transition-colors"
              >
                <ThreadIcon className="h-[16px] w-[16px] text-[#6F6A60]" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-mono text-xs">View Thread</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

