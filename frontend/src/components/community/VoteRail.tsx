import { ChevronUp, ChevronDown } from 'lucide-react';
import * as React from 'react';

interface VoteRailProps {
  score: number;
  userVote?: number | null;
  onVote: (value: -1 | 1 | 0) => void;
  disabled?: boolean;
}

export function VoteRail({ score, userVote, onVote, disabled }: VoteRailProps) {
  const [isVoting, setIsVoting] = React.useState(false);
  const [currentVote, setCurrentVote] = React.useState<number | null | undefined>(userVote);

  // Sync currentVote when userVote prop changes (e.g., on page reload)
  React.useEffect(() => {
    setCurrentVote(userVote);
  }, [userVote]);

  const handleVote = async (value: -1 | 1) => {
    if (disabled || isVoting) return;
    
    setIsVoting(true);
    try {
      // If clicking the same vote, remove it (value = 0)
      const newValue = currentVote === value ? 0 : value;
      // Optimistically update local state
      setCurrentVote(newValue === 0 ? null : newValue);
      await onVote(newValue);
      // State will be synced from prop after API response
    } catch (error) {
      // Rollback on error
      setCurrentVote(userVote);
      throw error;
    } finally {
      setIsVoting(false);
    }
  };

  const upvoteActive = currentVote === 1;
  const downvoteActive = currentVote === -1;

  return (
    <div className="flex flex-col items-center gap-1 py-2">
      <button
        onClick={() => handleVote(1)}
        disabled={disabled || isVoting}
        className={`
          p-1 rounded transition-colors
          ${upvoteActive 
            ? 'text-[#2F8F5B] hover:text-[#2F8F5B]/80' 
            : 'text-[#6F6A60] hover:text-[#1C1B17]'
          }
          ${disabled || isVoting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        aria-label="Upvote"
      >
        <ChevronUp className="h-5 w-5" />
      </button>
      
      <span className={`
        font-mono text-sm font-semibold tabular-nums
        ${score > 0 ? 'text-[#2F8F5B]' : score < 0 ? 'text-[#B23B2A]' : 'text-[#1C1B17]'}
      `}>
        {score}
      </span>
      
      <button
        onClick={() => handleVote(-1)}
        disabled={disabled || isVoting}
        className={`
          p-1 rounded transition-colors
          ${downvoteActive 
            ? 'text-[#B23B2A] hover:text-[#B23B2A]/80' 
            : 'text-[#6F6A60] hover:text-[#1C1B17]'
          }
          ${disabled || isVoting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        aria-label="Downvote"
      >
        <ChevronDown className="h-5 w-5" />
      </button>
    </div>
  );
}

