/**
 * useVote Hook - Reddit-style voting with optimistic updates
 * Handles atomic vote toggling with proper state management
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { ensureVoterSession } from '@/lib/auth/ensureVoterSession';
import toast from 'react-hot-toast';

export type VoteTargetType = 'post' | 'comment' | 'stock';
export type VoteIntent = 'up' | 'down';

interface VoteState {
  score: number;
  upvotes: number;
  downvotes: number;
  myVote: number | null; // -1, 1, or null
}

interface UseVoteOptions {
  targetType: VoteTargetType;
  targetId: string; // UUID for posts/comments, ticker string for stocks
  initialScore?: number;
  initialUpvotes?: number;
  initialDownvotes?: number;
  initialMyVote?: number | null;
  onUpdate?: (state: VoteState) => void;
}

interface UseVoteReturn {
  score: number;
  upvotes: number;
  downvotes: number;
  myVote: number | null;
  isVoting: boolean;
  castVote: (intent: VoteIntent) => Promise<void>;
}

/**
 * Calculate new vote state based on transition
 */
function calculateVoteTransition(
  currentVote: number | null,
  intent: VoteIntent
): { newValue: number | null; deltaUp: number; deltaDown: number; deltaScore: number } {
  const newValue = intent === 'up' ? 1 : -1;
  
  // If clicking the same vote, remove it
  if (currentVote === newValue) {
    return {
      newValue: null,
      deltaUp: currentVote === 1 ? -1 : 0,
      deltaDown: currentVote === -1 ? -1 : 0,
      deltaScore: currentVote === 1 ? -1 : 1,
    };
  }
  
  // If switching votes
  if (currentVote !== null && currentVote !== newValue) {
    return {
      newValue,
      deltaUp: intent === 'up' ? 1 : -1,
      deltaDown: intent === 'down' ? 1 : -1,
      deltaScore: intent === 'up' ? 2 : -2,
    };
  }
  
  // Adding new vote
  return {
    newValue,
    deltaUp: intent === 'up' ? 1 : 0,
    deltaDown: intent === 'down' ? 1 : 0,
    deltaScore: intent === 'up' ? 1 : -1,
  };
}

export function useVote({
  targetType,
  targetId,
  initialScore = 0,
  initialUpvotes = 0,
  initialDownvotes = 0,
  initialMyVote = null,
  onUpdate,
}: UseVoteOptions): UseVoteReturn {
  const [isVoting, setIsVoting] = useState(false);
  const [state, setState] = useState<VoteState>({
    score: initialScore,
    upvotes: initialUpvotes,
    downvotes: initialDownvotes,
    myVote: initialMyVote,
  });
  
  // Track previous initial values to detect changes
  const prevInitials = useRef({
    score: initialScore,
    upvotes: initialUpvotes,
    downvotes: initialDownvotes,
    myVote: initialMyVote,
  });

  // Initialize state on mount and sync when initial values change
  useEffect(() => {
    if (!isVoting) {
      // Check if initial values have changed
      const hasChanged = 
        prevInitials.current.score !== initialScore ||
        prevInitials.current.upvotes !== initialUpvotes ||
        prevInitials.current.downvotes !== initialDownvotes ||
        prevInitials.current.myVote !== initialMyVote;
      
      if (hasChanged) {
        prevInitials.current = {
          score: initialScore,
          upvotes: initialUpvotes,
          downvotes: initialDownvotes,
          myVote: initialMyVote,
        };
        
        setState({
          score: initialScore,
          upvotes: initialUpvotes,
          downvotes: initialDownvotes,
          myVote: initialMyVote,
        });
      }
    }
  }, [initialScore, initialUpvotes, initialDownvotes, initialMyVote, isVoting]);

  const castVote = useCallback(
    async (intent: VoteIntent) => {
      if (isVoting) {
        return; // Prevent double-clicks
      }

      setIsVoting(true);

      // Get current vote state
      const currentVote = state.myVote;
      const transition = calculateVoteTransition(currentVote, intent);

      // Optimistic update
      const optimisticState: VoteState = {
        score: state.score + transition.deltaScore,
        upvotes: Math.max(0, state.upvotes + transition.deltaUp),
        downvotes: Math.max(0, state.downvotes + transition.deltaDown),
        myVote: transition.newValue,
      };

      setState(optimisticState);
      onUpdate?.(optimisticState);

      try {
        // Ensure we have a Supabase session (creates anonymous session if needed)
        const hasSession = await ensureVoterSession();
        if (!hasSession) {
          throw new Error('Failed to establish voting session');
        }

        // Call RPC function (uses auth.uid() from JWT, no p_user_id parameter needed)
        const { data, error } = await supabase.rpc('rpc_cast_vote', {
          p_target_type: targetType,
          p_target_id: targetId,
          p_new_value: transition.newValue,
        });

        if (error) {
          throw error;
        }

        // Reconcile with server response
        const reconciledState: VoteState = {
          score: data.score,
          upvotes: data.upvotes,
          downvotes: data.downvotes,
          myVote: data.my_vote,
        };

        setState(reconciledState);
        onUpdate?.(reconciledState);
      } catch (error) {
        // Rollback optimistic update
        setState(state);
        onUpdate?.(state);
        
        console.error('Vote error:', error);
        toast.error('Failed to cast vote. Please try again.', { duration: 3000 });
      } finally {
        setIsVoting(false);
      }
    },
    [targetType, targetId, state, onUpdate]
  );

  return {
    score: state.score,
    upvotes: state.upvotes,
    downvotes: state.downvotes,
    myVote: state.myVote,
    isVoting,
    castVote,
  };
}

