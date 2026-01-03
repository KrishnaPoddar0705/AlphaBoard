import React from 'react'
import { Button } from '@/components/ui/button'
import { ArrowUp, ArrowDown, Plus, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface StockHeaderBarProps {
  ticker: string
  companyName?: string
  exchange?: string
  logoUrl?: string
  price: number
  changePercent: number
  change: number
  upvotes: number
  downvotes: number
  userVote: 'upvote' | 'downvote' | null
  onVote: (type: 'upvote' | 'downvote') => void
  onAddToWatchlist: () => void
}

export function StockHeaderBar({
  ticker,
  companyName,
  exchange,
  logoUrl,
  price,
  changePercent,
  change,
  upvotes,
  downvotes,
  userVote,
  onVote,
  onAddToWatchlist,
}: StockHeaderBarProps) {
  const navigate = useNavigate()
  const isPositive = changePercent >= 0

  return (
    <div className="bg-[#F1EEE0] border-b border-[#D7D0C2]">
      <div className="max-w-[1600px] mx-auto px-6 py-5">
        {/* Top row: Ticker/Company on left, Price on right */}
        <div className="flex items-start justify-between mb-4 pb-4 border-b border-[#D7D0C2]">
          <div className="flex items-start gap-3">
            {/* Company Logo */}
            <div className="relative w-12 h-12 flex-shrink-0">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={companyName || ticker}
                  className="w-12 h-12 rounded border border-[#D7D0C2] object-contain bg-[#F7F2E6]"
                  onError={(e) => {
                    // Hide image and show placeholder
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                    const placeholder = target.nextElementSibling as HTMLElement
                    if (placeholder) placeholder.style.display = 'flex'
                  }}
                />
              ) : null}
              <div className={`w-12 h-12 bg-[#F7F2E6] border border-[#D7D0C2] rounded flex items-center justify-center ${logoUrl ? 'hidden absolute inset-0' : ''}`}>
                <span className="text-lg font-mono font-bold text-[#1C1B17]">{ticker.slice(0, 2)}</span>
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-mono font-bold text-[#1C1B17] tracking-tight mb-1">
                {ticker}
              </h1>
              <p className="text-sm font-mono text-[#6F6A60]">
                {companyName || ticker}
                {exchange && ` • ${exchange}`}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-mono font-bold text-[#1C1B17] tabular-nums mb-1">
              ${price.toFixed(2)}
            </div>
            <div className={`text-sm font-mono tabular-nums ${
              isPositive ? 'text-[#2F8F5B]' : 'text-[#B23B2A]'
            }`}>
              {isPositive ? '+' : ''}{changePercent.toFixed(2)}% ({isPositive ? '+' : ''}${change.toFixed(2)})
            </div>
          </div>
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-3">
          <Button
            variant={userVote === 'upvote' ? 'default' : 'outline'}
            onClick={() => onVote('upvote')}
            className={`gap-2 font-mono ${
              userVote === 'upvote'
                ? 'bg-[#1C1B17] text-[#F7F2E6] border-[#1C1B17] hover:bg-[#1C1B17]/90'
                : 'bg-transparent border-[#D7D0C2] text-[#1C1B17] hover:bg-[#F7F2E6]'
            }`}
            size="sm"
          >
            <ArrowUp className="h-4 w-4" />
            <span className="tabular-nums">{upvotes}</span>
          </Button>
          <Button
            variant={userVote === 'downvote' ? 'default' : 'outline'}
            onClick={() => onVote('downvote')}
            className={`gap-2 font-mono ${
              userVote === 'downvote'
                ? 'bg-[#1C1B17] text-[#F7F2E6] border-[#1C1B17] hover:bg-[#1C1B17]/90'
                : 'bg-transparent border-[#D7D0C2] text-[#1C1B17] hover:bg-[#F7F2E6]'
            }`}
            size="sm"
          >
            <ArrowDown className="h-4 w-4" />
            <span className="tabular-nums">{downvotes}</span>
          </Button>
          <Button
            variant="outline"
            onClick={onAddToWatchlist}
            className="gap-2 font-mono bg-transparent border-[#D7D0C2] text-[#1C1B17] hover:bg-[#F7F2E6]"
            size="sm"
          >
            <Plus className="h-4 w-4" />
            Add To Watchlist
          </Button>
          <div className="ml-auto">
            <Button
              variant="ghost"
              onClick={() => navigate('/community')}
              className="gap-2 font-mono text-[#6F6A60] hover:text-[#1C1B17] hover:bg-transparent"
              size="sm"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Community
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

