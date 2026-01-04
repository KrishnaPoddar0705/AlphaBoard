import { useState } from 'react';
import { ExternalLink, Sparkles, Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { getELI5Summary } from '../lib/api';

interface NewsArticle {
  id: string;
  headline: string;
  source: string;
  source_url: string;
  published_at: string;
  summary_tldr: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  impact_score: number;
  full_content?: string;
}

interface NewsCardProps {
  article: NewsArticle;
}

export default function NewsCard({ article }: NewsCardProps) {
  const [showELI5, setShowELI5] = useState(false);
  const [eli5Summary, setEli5Summary] = useState<string>('');
  const [loadingELI5, setLoadingELI5] = useState(false);

  const handleELI5Click = async () => {
    if (showELI5) {
      setShowELI5(false);
      return;
    }

    if (eli5Summary) {
      setShowELI5(true);
      return;
    }

    setLoadingELI5(true);
    try {
      const response = await getELI5Summary(
        article.headline,
        article.full_content || article.summary_tldr
      );
      setEli5Summary(response.eli5_summary);
      setShowELI5(true);
    } catch (error) {
      setEli5Summary('Unable to generate simplified summary. Please try again.');
      setShowELI5(true);
    } finally {
      setLoadingELI5(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 60) {
        return `${diffMins}m ago`;
      } else if (diffHours < 24) {
        return `${diffHours}h ago`;
      } else if (diffDays < 7) {
        return `${diffDays}d ago`;
      } else {
        return date.toLocaleDateString();
      }
    } catch {
      return 'Recently';
    }
  };

  const getSentimentConfig = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return {
          color: 'text-emerald-400',
          bg: 'bg-emerald-500/20',
          border: 'border-emerald-500/30',
          icon: TrendingUp,
          label: 'Positive'
        };
      case 'negative':
        return {
          color: 'text-rose-400',
          bg: 'bg-rose-500/20',
          border: 'border-rose-500/30',
          icon: TrendingDown,
          label: 'Negative'
        };
      default:
        return {
          color: 'text-blue-400',
          bg: 'bg-blue-500/20',
          border: 'border-blue-500/30',
          icon: Minus,
          label: 'Neutral'
        };
    }
  };

  const getImpactColor = (score: number) => {
    if (score >= 7) return 'bg-rose-500';
    if (score >= 4) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const sentimentConfig = getSentimentConfig(article.sentiment);
  const SentimentIcon = sentimentConfig.icon;

  return (
    <div className="bg-white/5 rounded-lg border border-white/10 p-4 hover:border-indigo-500/50 transition-all">
      {/* Header with Source and Time */}
      <div className="flex items-center justify-between mb-2">
        <a
          href={article.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors"
        >
          <span>{article.source}</span>
          <ExternalLink className="w-3 h-3" />
        </a>
        <span className="text-xs text-gray-500">
          {formatTimeAgo(article.published_at)}
        </span>
      </div>

      {/* Headline */}
      <h3 className="text-white font-semibold text-base mb-3 leading-snug">
        {article.headline}
      </h3>

      {/* GPT Summary */}
      {article.summary_tldr && (
        <p className="text-gray-300 text-sm mb-3 leading-relaxed italic">
          {article.summary_tldr}
        </p>
      )}

      {/* Sentiment and Impact Score */}
      <div className="flex items-center gap-3 mb-3">
        {/* Sentiment Badge */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${sentimentConfig.bg} border ${sentimentConfig.border}`}>
          <SentimentIcon className={`w-3.5 h-3.5 ${sentimentConfig.color}`} />
          <span className={`text-xs font-medium ${sentimentConfig.color}`}>
            {sentimentConfig.label}
          </span>
        </div>

        {/* Impact Score */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Impact:</span>
          <div className="flex items-center gap-1">
            {/* Impact Bar */}
            <div className="flex gap-0.5">
              {[...Array(10)].map((_, i) => (
                <div
                  key={i}
                  className={`w-1 h-4 rounded-sm ${
                    i < article.impact_score
                      ? getImpactColor(article.impact_score)
                      : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs font-mono font-bold text-white ml-1">
              {article.impact_score}/10
            </span>
          </div>
        </div>
      </div>

      {/* ELI5 Button */}
      <button
        onClick={handleELI5Click}
        disabled={loadingELI5}
        className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
      >
        {loadingELI5 ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Simplifying...</span>
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            <span>{showELI5 ? 'Hide' : 'Explain like I\'m 12'}</span>
          </>
        )}
      </button>

      {/* ELI5 Summary (Expandable) */}
      {showELI5 && eli5Summary && (
        <div className="mt-3 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-semibold text-purple-400 uppercase">
              Simple Explanation
            </span>
          </div>
          <p className="text-gray-200 text-sm leading-relaxed">
            {eli5Summary}
          </p>
        </div>
      )}
    </div>
  );
}

