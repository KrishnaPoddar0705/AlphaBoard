import { Target, ImageIcon } from 'lucide-react';
import ThesisMarkdown from '@/components/thesis/ThesisMarkdown';
import { getCurrencySymbol } from '../../../lib/utils';
import { formatIrr, timeframeFromMonths } from '../../../lib/irrTargets';
import { formatDate, type IrrTarget, type Recommendation } from './types';

/**
 * One recommendation as it appears inside an expanded analyst row: prices, thesis,
 * IRR target timeline and attachments. Read-only everywhere it is used -- a
 * portfolio manager viewing their team gets exactly this, with no edit affordances.
 */
export default function RecommendationDetailCard({
  recommendation: rec,
  irrTargets,
}: {
  recommendation: Recommendation;
  irrTargets: IrrTarget[];
}) {
  const tickerTargets = irrTargets.filter((t) => t.ticker === rec.ticker);

  return (
    <div className="bg-[var(--card-bg)] p-5 rounded-lg border border-[var(--border-color)] shadow-lg">
      {/* Recommendation Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-indigo-400">{rec.ticker}</span>
          <span className={`px-3 py-1 text-sm font-semibold rounded ${rec.action === 'BUY'
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}>
            {rec.action || 'BUY'}
          </span>
          <span className={`px-2 py-1 text-xs font-medium rounded ${rec.status === 'OPEN'
              ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
              : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)]'
            }`}>
            {rec.status || 'OPEN'}
          </span>
        </div>
        <div className="text-right">
          <div className="text-xs text-[var(--text-secondary)]">Entry Date</div>
          <div className="text-sm font-medium text-[var(--text-primary)]">{formatDate(rec.entry_date)}</div>
        </div>
      </div>

      {/* Price Information */}
      <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-[var(--bg-secondary)] rounded border border-[var(--border-color)]">
        <div>
          <div className="text-xs text-[var(--text-secondary)] mb-1">Entry Price</div>
          <div className="text-lg font-semibold text-[var(--text-primary)]">{getCurrencySymbol(rec.ticker)}{rec.entry_price}</div>
        </div>
        {rec.exit_price && (
          <div>
            <div className="text-xs text-[var(--text-secondary)] mb-1">Exit Price</div>
            <div className="text-lg font-semibold text-[var(--text-primary)]">{getCurrencySymbol(rec.ticker)}{rec.exit_price}</div>
          </div>
        )}
        {tickerTargets.length > 0 && (
          <div>
            <div className="text-xs text-[var(--text-secondary)] mb-1">IRR Targets</div>
            <div className="flex gap-2 flex-wrap">
              {tickerTargets.map((t) => (
                <span key={t.id} className="text-sm font-semibold text-purple-400">
                  {t.target_irr !== null && t.target_irr !== undefined
                    ? `${formatIrr(t.target_irr)} IRR`
                    : `${getCurrencySymbol(rec.ticker)}${t.target_price}`}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Thesis */}
      {rec.thesis && (
        <div className="mb-4">
          <div className="text-sm font-semibold text-[var(--text-primary)] mb-2">Investment Thesis:</div>
          <div className="text-sm text-[var(--text-primary)] bg-indigo-500/10 p-3 rounded border-l-4 border-indigo-500">
            <ThesisMarkdown content={rec.thesis} />
          </div>
        </div>
      )}

      {/* IRR Target Timeline */}
      {tickerTargets.length > 0 && (
        <div className="mb-4">
          <div className="text-sm font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
            <Target className="w-4 h-4" />
            IRR Target Timeline:
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {tickerTargets.map((target) => {
              const timeframe = timeframeFromMonths(
                target.timeframe_start_months,
                target.timeframe_end_months
              );
              const isLegacy = target.target_irr === null || target.target_irr === undefined;
              return (
                <div key={target.id} className="bg-purple-500/20 p-3 rounded border border-purple-500/30 min-w-[150px]">
                  <div className="text-lg font-bold text-purple-400">
                    {isLegacy
                      ? `${getCurrencySymbol(rec.ticker)}${target.target_price}`
                      : `${formatIrr(target.target_irr)} IRR`}
                  </div>
                  {timeframe && (
                    <div className="text-xs text-[var(--text-secondary)] mt-1">
                      {timeframe.label}
                    </div>
                  )}
                  {isLegacy && target.target_date && (
                    <div className="text-xs text-[var(--text-secondary)] mt-1">
                      Target: {formatDate(target.target_date)}
                    </div>
                  )}
                  <div className="text-xs text-[var(--text-tertiary)] mt-1">
                    Set: {formatDate(target.created_at)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Screenshots/Images */}
      {rec.images && rec.images.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            Attachments ({rec.images.length}):
          </div>
          <div className="flex gap-2 flex-wrap">
            {rec.images.map((image, idx) => (
              <div key={idx} className="relative w-32 h-32 bg-[var(--card-bg)] rounded border border-[var(--border-color)] overflow-hidden hover:opacity-90 cursor-pointer">
                <img
                  src={image}
                  alt={`Attachment ${idx + 1}`}
                  className="w-full h-full object-cover"
                  onClick={() => window.open(image, '_blank')}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
