/**
 * News Sidebar Component
 * 
 * Right sidebar showing news articles and key ratios for selected stock.
 * Matches the reference image design.
 */

import { useEffect, useState } from 'react';
import { Card } from '../ui/card';
import { Separator } from '../ui/separator';
import { getStockNews } from '../../lib/api';
import NewsCard from '../NewsCard';
import { Loader2 } from 'lucide-react';

interface NewsSidebarProps {
  ticker: string;
  companyName?: string;
}

export function NewsSidebar({ ticker, companyName }: NewsSidebarProps) {
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      if (!ticker) return;
      setLoading(true);
      try {
        const newsData = await getStockNews(ticker);
        setNews(newsData.articles || newsData || []);
      } catch (error) {
        console.error('Error fetching news:', error);
        setNews([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, [ticker]);

  return (
    <div className="w-96 border-l overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        {/* News Section */}
        <div>
          <h2 className="text-lg font-semibold mb-4">
            {ticker} News
          </h2>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : news.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              No news available
            </div>
          ) : (
            <div className="space-y-4">
              {news.slice(0, 3).map((article, index) => (
                <div key={article.id || index}>
                  <NewsCard article={article} />
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Key Ratios Section */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Key Ratios</h2>
          <div className="text-sm text-muted-foreground">
            {/* Key ratios will be populated from stock data */}
            <p>Ratios data coming soon...</p>
          </div>
        </div>
      </div>
    </div>
  );
}

