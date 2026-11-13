import { useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ImageUploader } from './ImageUploader';
import { createComment } from '@/lib/community/api';

interface CommentComposerProps {
  postId: string;
  parentCommentId?: string | null;
  onSuccess: () => void;
  onCancel?: () => void;
  placeholder?: string;
}

export function CommentComposer({
  postId,
  parentCommentId,
  onSuccess,
  onCancel,
  placeholder = 'Write a comment...',
}: CommentComposerProps) {
  const { user } = useUser();
  const [body, setBody] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  if (!user) {
    return (
      <div className="p-4 border border-border-editorial rounded bg-paper-light text-center">
        <p className="font-mono text-sm text-ink-muted">
          Please sign in to comment
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;

    try {
      setSubmitting(true);
      await createComment({
        post_id: postId,
        parent_comment_id: parentCommentId,
        body: body.trim(),
        images: images.length > 0 ? images : undefined,
        clerkUserId: user.id,
      });
      setBody('');
      setImages([]);
      onSuccess();
    } catch (error: any) {
      alert(error.message || 'Failed to create comment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        className="font-mono text-sm border-border-editorial bg-paper-alt text-ink focus:ring-2 focus:ring-ink/20"
        rows={4}
        disabled={submitting}
      />

      <ImageUploader
        images={images}
        onChange={setImages}
        disabled={submitting}
      />

      <div className="flex items-center gap-2">
        <Button
          type="submit"
          disabled={!body.trim() || submitting}
          className="font-mono text-sm bg-ink text-paper-light hover:bg-ink/90 disabled:opacity-50"
        >
          {submitting ? 'Posting...' : 'Post Comment'}
        </Button>
        {onCancel && (
          <Button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            variant="outline"
            className="font-mono text-sm border-border-editorial bg-transparent text-ink hover:bg-paper-alt"
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

