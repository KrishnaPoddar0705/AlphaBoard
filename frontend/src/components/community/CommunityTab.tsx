import { useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { PostList } from './PostList';
import { PostDetail } from './PostDetail';
import { PostComposerDialog } from './PostComposerDialog';

export function CommunityTab() {
  const { ticker, postId } = useParams<{ ticker: string; postId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [showComposer, setShowComposer] = useState(false);

  if (!ticker) return null;

  // Check if we're viewing a specific post
  const isPostDetail = location.pathname.includes('/community/') && postId;

  return (
    <>
      {isPostDetail ? (
        <PostDetail />
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-6">
            <PostList
              ticker={ticker}
              onCreatePost={() => setShowComposer(true)}
            />
          </div>
        </div>
      )}

      <PostComposerDialog
        ticker={ticker}
        open={showComposer}
        onClose={() => setShowComposer(false)}
      />
    </>
  );
}

