import { useState } from 'react';
import { X } from 'lucide-react';
import type { CommunityAttachment } from '@/lib/community/types';

interface ImageGridProps {
  images: CommunityAttachment[];
  maxDisplay?: number;
}

export function ImageGrid({ images, maxDisplay = 2 }: ImageGridProps) {
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  if (!images || images.length === 0) return null;

  const displayImages = images.slice(0, maxDisplay);
  const remainingCount = images.length - maxDisplay;

  return (
    <>
      <div className={`grid gap-2 mt-2 ${displayImages.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {displayImages.map((img, index) => (
          <button
            key={img.id}
            onClick={() => img.url && setLightboxImage(img.url)}
            className="relative aspect-video overflow-hidden rounded border border-[#D7D0C2] bg-[#FBF7ED] hover:border-[#1C1B17] transition-colors"
          >
            <img
              src={img.url}
              alt={`Attachment ${index + 1}`}
              className="w-full h-full object-cover"
            />
            {remainingCount > 0 && index === displayImages.length - 1 && (
              <div className="absolute inset-0 bg-[#1C1B17]/60 flex items-center justify-center">
                <span className="font-mono text-sm text-[#F7F2E6]">
                  +{remainingCount} more
                </span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-[#1C1B17]/90 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 p-2 bg-[#F7F2E6] text-[#1C1B17] rounded-full hover:bg-[#FBF7ED] transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightboxImage}
            alt="Full size"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

