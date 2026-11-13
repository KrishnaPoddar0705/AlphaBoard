import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { PostCard } from './PostCard';
import { SortBar } from './SortBar';
import { listPosts } from '@/lib/community/api';
import type { CommunityPost, SortOption, TopTimeframe } from '@/lib/community/types';

interface PostListProps {
  ticker: string;
  onCreatePost: () => void;
}

export function PostList({ ticker, onCreatePost }: PostListProps) {
  const { user } = useUser();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortOption>('hot');
  const [timeframe, setTimeframe] = useState<TopTimeframe>('all');
  const [nextCursor, setNextCursor] = useState<string | undefined>();

  const loadPosts = async (reset = false) => {
    try {
      setLoading(true);
      const result = await listPosts({
        ticker,
        sort,
        timeframe: sort === 'top' ? timeframe : undefined,
        cursor: reset ? undefined : nextCursor,
        limit: 20,
        clerkUserId: user?.id,
      });
      
      if (reset) {
        setPosts(result.posts);
      } else {
        setPosts(prev => [...prev, ...result.posts]);
      }
      setNextCursor(result.nextCursor);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts(true);
  }, [ticker, sort, timeframe, user?.id]);

  return (
    <div className="space-y-4">
      <SortBar
        sort={sort}
        timeframe={timeframe}
        onSortChange={setSort}
        onTimeframeChange={setTimeframe}
        onCreatePost={onCreatePost}
        postCount={posts.length}
      />

      {loading && posts.length === 0 ? (
        <div className="text-center py-12">
          <p className="font-mono text-ink-muted">Loading posts...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 border border-border-editorial rounded bg-paper-light">
          <p className="font-mono text-ink-muted mb-2">No posts yet</p>
          <p className="text-sm font-mono text-ink-muted">Be the first to start a discussion!</p>
        </div>
      ) : (
        <>
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              ticker={ticker}
            />
          ))}
          
          {nextCursor && (
            <div className="text-center py-4">
              <button
                onClick={() => loadPosts(false)}
                disabled={loading}
                className="px-4 py-2 font-mono text-sm border border-border-editorial rounded bg-paper-light text-ink hover:bg-paper-alt transition-colors disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

