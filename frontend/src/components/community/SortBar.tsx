// import { useState } from 'react'; // Unused
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SortOption, TopTimeframe } from '@/lib/community/types';

interface SortBarProps {
  sort: SortOption;
  timeframe: TopTimeframe;
  onSortChange: (sort: SortOption) => void;
  onTimeframeChange: (timeframe: TopTimeframe) => void;
  onCreatePost: () => void;
  postCount?: number;
}

export function SortBar({
  sort,
  timeframe,
  onSortChange,
  onTimeframeChange,
  onCreatePost,
  postCount,
}: SortBarProps) {
  return (
    <div className="flex items-center justify-between gap-4 pb-4 border-b border-border-editorial">
      <div className="flex items-center gap-3">
        <Select value={sort} onValueChange={onSortChange}>
          <SelectTrigger className="w-32 font-mono border-border-editorial bg-paper-light text-ink">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-paper-light border-border-editorial">
            <SelectItem value="hot" className="font-mono">Hot</SelectItem>
            <SelectItem value="new" className="font-mono">New</SelectItem>
            <SelectItem value="top" className="font-mono">Top</SelectItem>
          </SelectContent>
        </Select>

        {sort === 'top' && (
          <div className="flex items-center gap-1">
            {(['24h', '7d', 'all'] as TopTimeframe[]).map((tf) => (
              <button
                key={tf}
                onClick={() => onTimeframeChange(tf)}
                className={`
                  px-3 py-1 text-xs font-mono rounded border transition-colors
                  ${timeframe === tf
                    ? 'bg-ink text-paper-light border-ink'
                    : 'bg-transparent text-ink border-border-editorial hover:bg-paper-alt'
                  }
                `}
              >
                {tf === 'all' ? 'All' : tf.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {postCount !== undefined && (
          <span className="text-sm font-mono text-ink-muted">
            {postCount} {postCount === 1 ? 'post' : 'posts'}
          </span>
        )}
      </div>

      <Button
        onClick={onCreatePost}
        className="font-mono border-border-editorial bg-transparent text-ink hover:bg-paper-alt"
        variant="outline"
      >
        Create Post
      </Button>
    </div>
  );
}

