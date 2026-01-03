import { ChevronUp, ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface VoteRailProps {
  score: number;
  userVote?: number | null;
  onVote: (value: -1 | 1 | 0) => void;
  disabled?: boolean;
}

export function VoteRail({ score, userVote, onVote, disabled }: VoteRailProps) {
  const [isVoting, setIsVoting] = useState(false);

  const handleVote = async (value: -1 | 1) => {
    if (disabled || isVoting) return;
    
    setIsVoting(true);
    try {
      // If clicking the same vote, remove it (value = 0)
      const newValue = userVote === value ? 0 : value;
      await onVote(newValue);
    } finally {
      setIsVoting(false);
    }
  };

  const upvoteActive = userVote === 1;
  const downvoteActive = userVote === -1;

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

