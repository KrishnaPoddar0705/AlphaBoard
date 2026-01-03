import React from 'react'
import { Button } from '@/components/ui/button'
import { TrendingUp, TrendingDown, ThumbsUp, MessageCircle } from 'lucide-react'

export type SortOption = 'all' | 'winners' | 'losers' | 'most-voted' | 'most-comments'

interface SortingBannerProps {
  sortBy: SortOption
  onSortChange: (sort: SortOption) => void
}

export const SortingBanner: React.FC<SortingBannerProps> = ({ sortBy, onSortChange }) => {
  const sortOptions: Array<{ value: SortOption; label: string; icon: React.ReactNode }> = [
    { value: 'all', label: 'All', icon: null },
    { value: 'winners', label: 'Top Winners', icon: <TrendingUp className="h-3 w-3" /> },
    { value: 'losers', label: 'Top Losers', icon: <TrendingDown className="h-3 w-3" /> },
    { value: 'most-voted', label: 'Most Voted', icon: <ThumbsUp className="h-3 w-3" /> },
    { value: 'most-comments', label: 'Most Comments', icon: <MessageCircle className="h-3 w-3" /> },
  ]

  return (
    <div className="flex items-center gap-2 flex-wrap pb-4 border-b border-[#D7D0C2]">
      <span className="text-sm font-medium text-[#6F6A60] mr-2">Sort by:</span>
      {sortOptions.map((option) => (
        <Button
          key={option.value}
          variant={sortBy === option.value ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSortChange(option.value)}
          className="px-3 py-1.5 gap-1.5"
        >
          {option.icon}
          <span>{option.label}</span>
        </Button>
      ))}
    </div>
  )
}

