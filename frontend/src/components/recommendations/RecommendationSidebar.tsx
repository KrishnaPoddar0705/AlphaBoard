import React from 'react'
import { Card, CardContent } from '@/components/ui/card-new'
import { Badge } from '@/components/ui/badge'

interface Recommendation {
  id: string
  ticker: string
  entry_price: number
  current_price?: number
  status: string
  entry_date: string
  action?: string
}

interface RecommendationSidebarProps {
  recommendations: Recommendation[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function RecommendationSidebar({ recommendations, selectedId, onSelect }: RecommendationSidebarProps) {
  const calculateReturn = (rec: Recommendation) => {
    if (!rec.entry_price || !rec.current_price) return null
    const returnPct = ((rec.current_price - rec.entry_price) / rec.entry_price) * 100
    return rec.action === 'SELL' ? -returnPct : returnPct
  }

  return (
    <div className="w-80 border-r border-[#D7D0C2] bg-[#F7F2E6] h-full overflow-y-auto">
      <div className="p-4 space-y-2">
        {recommendations.length === 0 ? (
          <div className="text-center py-8 text-[#6F6A60] font-mono text-sm">
            No open recommendations
          </div>
        ) : (
          recommendations.map((rec) => {
            const returnPct = calculateReturn(rec)
            const isSelected = selectedId === rec.id
            const isPositive = returnPct !== null && returnPct >= 0

            return (
              <Card
                key={rec.id}
                onClick={() => onSelect(rec.id)}
                className={`cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-[#FBF7ED] border-[#1C1B17] border-2'
                    : 'bg-[#F7F2E6] border-[#D7D0C2] hover:border-[#1C1B17]'
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-mono font-bold text-[#1C1B17] text-base">{rec.ticker}</h3>
                        {rec.action && rec.action !== 'WATCH' && (
                          <Badge
                            variant={rec.action === 'BUY' ? 'default' : 'destructive'}
                            className="font-mono text-xs px-1.5 py-0"
                          >
                            {rec.action}
                          </Badge>
                        )}
                      </div>
                      <p className="font-mono text-xs text-[#6F6A60] mt-1">
                        {new Date(rec.entry_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <Badge
                      variant={rec.status === 'OPEN' ? 'default' : 'secondary'}
                      className="font-mono text-xs"
                    >
                      {rec.status}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-xs text-[#6F6A60]">Current</span>
                      <span className="font-mono font-semibold text-[#1C1B17] tabular-nums">
                        ${rec.current_price?.toFixed(2) || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-xs text-[#6F6A60]">Entry</span>
                      <span className="font-mono text-sm text-[#1C1B17] tabular-nums">
                        ${rec.entry_price?.toFixed(2) || 'N/A'}
                      </span>
                    </div>
                    {returnPct !== null && (
                      <div className="flex justify-between items-center pt-1 border-t border-[#E3DDCF]">
                        <span className="font-mono text-xs text-[#6F6A60]">Return</span>
                        <span
                          className={`font-mono font-semibold tabular-nums ${
                            isPositive ? 'text-[#2F8F5B]' : 'text-[#B23B2A]'
                          }`}
                        >
                          {isPositive ? '+' : ''}
                          {returnPct.toFixed(2)}%
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}

