import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card-new';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { MessageSquare, Bookmark } from 'lucide-react';
import { MiniLineChart } from '@/components/charts/MiniLineChart';
import { CommunityActionStrip } from './CommunityActionStrip';

interface CommunityStockCardProps {
  ticker: string;
  companyName?: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  sparklineData: Array<{ timestamp: number; price: number; open?: number; close?: number }>;
  threadCount: number; // Number of threads (posts) for this ticker
  commentsCount: number; // Total number of comments across all posts
  // Stock-level voting data
  stockScore?: number; // Stock-level score (from community_stocks)
  stockUpvotes?: number;
  stockDownvotes?: number;
  stockUserVote?: number | null; // -1, 1, or null for stock-level vote
  isLoading?: boolean;
  top_thread_title?: string | null;
  isBookmarked?: boolean;
  onVote?: () => void; // Callback to refetch feed after voting
  onBookmark?: (ticker: string, isBookmarked: boolean) => void; // Callback when bookmark is toggled
}

// Helper function to trim .NS or .BO from ticker for display
function trimTickerSuffix(ticker: string): string {
  return ticker.replace(/\.NS$/, '').replace(/\.BO$/, '')
}

export function CommunityStockCard({
  ticker,
  companyName,
  price,
  change,
  changePercent,
  sparklineData,
  threadCount,
  commentsCount,
  stockScore = 0,
  stockUpvotes = 0,
  stockDownvotes = 0,
  stockUserVote = null,
  isLoading = false,
  top_thread_title,
  isBookmarked = false,
  onVote,
  onBookmark,
}: CommunityStockCardProps) {
  const navigate = useNavigate();
  
  // Trim .NS or .BO from ticker for display
  const displayTicker = trimTickerSuffix(ticker)
  
  const isPositive = changePercent !== null && changePercent >= 0;

  const handleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onBookmark) {
      onBookmark(ticker, !isBookmarked);
    }
  };

  const handleCardClick = () => {
    navigate(`/stock/${ticker}`);
  };

  return (
    <Card 
      className="border border-[#D7D0C2] bg-[#F7F2E6] rounded-xl shadow-none hover:border-[#1C1B17]/30 transition-colors cursor-pointer"
      onClick={handleCardClick}
    >
      <CardContent className="p-[16px] space-y-[12px]">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-semibold font-mono text-[#1C1B17] leading-tight">
              {displayTicker}
            </h3>
            {companyName && (
              <p className="text-xs text-[#6F6A60] mt-0.5 line-clamp-1">
                {companyName}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Percent change badge */}
            {changePercent !== null ? (
              <Badge
                className={`text-xs font-mono tabular-nums px-2 py-0.5 ${
                  isPositive
                    ? 'bg-[rgba(47,143,91,0.12)] text-[#2F8F5B] border-0'
                    : 'bg-[rgba(178,59,42,0.12)] text-[#B23B2A] border-0'
                }`}
              >
                {isPositive ? '+' : ''}
                {changePercent.toFixed(2)}%
              </Badge>
            ) : (
              <Badge className="text-xs font-mono tabular-nums px-2 py-0.5 bg-[rgba(111,106,96,0.12)] text-[#6F6A60] border-0">
                N/A
              </Badge>
            )}
          </div>
        </div>

        {/* Price and Sparkline */}
        <div className="grid grid-cols-[1fr,120px] gap-3 items-center">
          <div>
            <div className="text-3xl font-bold font-mono tabular-nums text-[#1C1B17]">
              {isLoading ? '...' : price !== null && price > 0 ? `$${price.toFixed(2)}` : 'N/A'}
            </div>
            {price !== null && price > 0 && change !== null && (
              <div className={`text-sm font-mono tabular-nums mt-0.5 ${
                isPositive ? 'text-[#2F8F5B]' : 'text-[#B23B2A]'
              }`}>
                {isPositive ? '+' : ''}${Math.abs(change).toFixed(2)} today
                <span className="text-[#6F6A60] ml-1">from last day</span>
              </div>
            )}
          </div>
          <div className="h-14 border border-[#D7D0C2] rounded bg-[#FBF7ED] overflow-hidden flex items-center justify-center">
            {isLoading || !sparklineData || sparklineData.length === 0 ? (
              <span className="text-[10px] font-mono text-[#6F6A60]">No data</span>
            ) : (
              <MiniLineChart
                data={sparklineData}
                isPositive={isPositive}
                height={56}
              />
            )}
          </div>
        </div>

        {/* Separator */}
        <Separator className="bg-[#D7D0C2]" />

        {/* Top Thread Preview */}
        {threadCount > 0 && top_thread_title && (
          <div className="flex items-start gap-1.5">
            <MessageSquare className="h-3 w-3 text-[#6F6A60] mt-0.5 flex-shrink-0" />
            <p className="text-xs font-mono text-[#6F6A60] line-clamp-1 flex-1">
              {top_thread_title}
            </p>
          </div>
        )}

        {/* Footer - Action Strip + Bookmark */}
        <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
          <CommunityActionStrip
            onVote={onVote}
            variant="stock"
            targetType="stock"
            targetId={ticker}
            ticker={ticker}
            score={stockScore}
            upvotes={stockUpvotes}
            downvotes={stockDownvotes}
            myVote={stockUserVote}
            commentCount={commentsCount}
            threadCount={threadCount}
            className="flex-1"
          />

          {/* Bookmark button */}
          <Button
            variant="outline"
            size="sm"
            className={`h-[34px] px-2 font-mono border-[#D7D0C2] bg-[#F7F2E6] text-[#1C1B17] hover:bg-[rgba(28,27,23,0.04)] ${
              isBookmarked ? 'bg-[rgba(47,143,91,0.12)] border-[#2F8F5B]' : ''
            }`}
            onClick={handleBookmark}
          >
            <Bookmark
              className={`h-[16px] w-[16px] ${
                isBookmarked ? 'text-[#2F8F5B] fill-[#2F8F5B]' : 'text-[#6F6A60]'
              }`}
            />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

