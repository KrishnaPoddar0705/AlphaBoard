import { useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ImageUploader } from './ImageUploader';
import { createPost } from '@/lib/community/api';
import { useNavigate } from 'react-router-dom';

interface PostComposerDialogProps {
  ticker: string;
  open: boolean;
  onClose: () => void;
}

export function PostComposerDialog({ ticker, open, onClose }: PostComposerDialogProps) {
  const { user } = useUser();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  if (!user) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1B17]/60">
        <div className="bg-[#F7F2E6] border border-[#D7D0C2] rounded-lg p-6 max-w-md w-full mx-4">
          <p className="font-mono text-sm text-[#6F6A60] text-center">
            Please sign in to create a post
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;

    try {
      setSubmitting(true);
      const post = await createPost({
        ticker,
        title: title.trim(),
        body: body.trim(),
        images: images.length > 0 ? images : undefined,
        clerkUserId: user.id,
      });
      onClose();
      navigate(`/stock/${ticker}/community/${post.id}`);
    } catch (error: any) {
      alert(error.message || 'Failed to create post');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1B17]/60 p-4">
      <div className="bg-[#F7F2E6] border border-[#D7D0C2] rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#F7F2E6] border-b border-[#D7D0C2] p-4 flex items-center justify-between">
          <h2 className="font-mono font-semibold text-lg text-[#1C1B17]">
            Create Post for {ticker}
          </h2>
          <button
            onClick={onClose}
            className="text-[#6F6A60] hover:text-[#1C1B17] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-mono font-medium text-[#1C1B17] mb-1">
              Title <span className="text-[#B23B2A]">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter post title..."
              maxLength={120}
              className="font-mono border-[#D7D0C2] bg-[#FBF7ED] text-[#1C1B17] focus:ring-2 focus:ring-[#1C1B17]/20"
              disabled={submitting}
            />
            <p className="text-xs font-mono text-[#6F6A60] mt-1">
              {title.length}/120 characters
            </p>
          </div>

          <div>
            <label className="block text-sm font-mono font-medium text-[#1C1B17] mb-1">
              Body <span className="text-[#B23B2A]">*</span>
            </label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your post..."
              className="font-mono text-sm border-[#D7D0C2] bg-[#FBF7ED] text-[#1C1B17] focus:ring-2 focus:ring-[#1C1B17]/20"
              rows={8}
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-sm font-mono font-medium text-[#1C1B17] mb-2">
              Images (optional)
            </label>
            <ImageUploader
              images={images}
              onChange={setImages}
              disabled={submitting}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#D7D0C2]">
            <Button
              type="button"
              onClick={onClose}
              disabled={submitting}
              variant="outline"
              className="font-mono border-[#D7D0C2] bg-transparent text-[#1C1B17] hover:bg-[#FBF7ED]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || !body.trim() || submitting}
              className="font-mono bg-[#1C1B17] text-[#F7F2E6] hover:bg-[#1C1B17]/90 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Post'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

