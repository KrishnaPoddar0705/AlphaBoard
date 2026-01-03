import { useState } from 'react';
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
    <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#D7D0C2]">
      <div className="flex items-center gap-3">
        <Select value={sort} onValueChange={onSortChange}>
          <SelectTrigger className="w-32 font-mono border-[#D7D0C2] bg-[#F7F2E6] text-[#1C1B17]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#F7F2E6] border-[#D7D0C2]">
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
                    ? 'bg-[#1C1B17] text-[#F7F2E6] border-[#1C1B17]'
                    : 'bg-transparent text-[#1C1B17] border-[#D7D0C2] hover:bg-[#FBF7ED]'
                  }
                `}
              >
                {tf === 'all' ? 'All' : tf.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {postCount !== undefined && (
          <span className="text-sm font-mono text-[#6F6A60]">
            {postCount} {postCount === 1 ? 'post' : 'posts'}
          </span>
        )}
      </div>

      <Button
        onClick={onCreatePost}
        className="font-mono border-[#D7D0C2] bg-transparent text-[#1C1B17] hover:bg-[#FBF7ED]"
        variant="outline"
      >
        Create Post
      </Button>
    </div>
  );
}

