/**
 * Enhanced Stock Panel Component
 * 
 * Comprehensive panel showing recommendations, watchlist, and history with:
 * - Full stock details (thesis, price targets, entry/exit info)
 * - Add new recommendations/watchlist functionality
 * - Expandable stock detail views
 * - Price target timeline
 * - Images and attachments
 */

import { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import { Plus, ChevronDown, ChevronUp, X, Search, Upload, AlertCircle, Target, Calendar } from 'lucide-react';
import { PaperCard } from './paper/PaperCard';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { getPriceTargets, createRecommendation, searchStocks } from '../../lib/api';
import { safeWarn, safeError } from '../../lib/logger';

interface EnhancedStockPanelProps {
  recommendations: any[];
  selectedTicker: string | null;
  onSelectTicker: (ticker: string) => void;
  viewMode: 'active' | 'watchlist' | 'history';
  onViewModeChange: (mode: 'active' | 'watchlist' | 'history') => void;
  onRefresh: () => void;
  className?: string;
}

export function EnhancedStockPanel({
  recommendations,
  selectedTicker,
  onSelectTicker,
  viewMode,
  onViewModeChange,
  onRefresh,
  className = '',
}: EnhancedStockPanelProps) {
  const { session } = useAuth();
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isWatchlistAdd, setIsWatchlistAdd] = useState(false);
  const [priceTargets, setPriceTargets] = useState<Record<string, any[]>>({});
  
  // Form state
  const [ticker, setTicker] = useState('');
  const [action, setAction] = useState<'BUY' | 'SELL'>('BUY');
  const [entryPrice, setEntryPrice] = useState('');
  const [priceTarget, setPriceTarget] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [thesis, setThesis] = useState('');
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter recommendations by view mode
  const filteredRecs = recommendations.filter((rec) => {
    if (viewMode === 'active') return rec.status === 'OPEN';
    if (viewMode === 'watchlist') return rec.status === 'WATCHLIST';
    if (viewMode === 'history') return rec.status === 'CLOSED';
    return false;
  });

  // Get unique tickers
  const uniqueTickers = Array.from(
    new Map(filteredRecs.map((rec) => [rec.ticker, rec])).values()
  );

  // Fetch price targets for expanded ticker
  useEffect(() => {
    if (expandedTicker && session?.user?.id) {
      const fetchPriceTargets = async () => {
        try {
          const targets = await getPriceTargets(expandedTicker, session.user.id);
          setPriceTargets(prev => ({ ...prev, [expandedTicker]: targets || [] }));
        } catch (err) {
          safeWarn('Failed to fetch price targets', err);
        }
      };
      fetchPriceTargets();
    }
  }, [expandedTicker, session?.user?.id]);

  const getReturnDisplay = (rec: any) => {
    if (rec.status === 'CLOSED' && rec.final_return_pct !== undefined) {
      return rec.final_return_pct;
    }
    if (rec.entry_price && rec.current_price) {
      const returnPct = ((rec.current_price - rec.entry_price) / rec.entry_price) * 100;
      return rec.action === 'SELL' ? -returnPct : returnPct;
    }
    return null;
  };

  const getCurrencySymbol = (ticker: string) => {
    if (ticker.includes('.NS') || ticker.includes('.BO')) return '₹';
    return '$';
  };

  const handleSearch = async (value: string) => {
    setTicker(value);
    
    if (value.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const results = await searchStocks(value);
      setSearchResults(results || []);
      
      // Auto-select if only one result
      if (results && results.length === 1) {
        selectStock(results[0].symbol);
      }
    } catch (err) {
      safeError('Search failed', err);
      setSearchResults([]);
    }
  };

  const selectStock = (symbol: string) => {
    setTicker(symbol);
    setSearchResults([]);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedImages(prev => [...prev, ...files]);
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id) {
      setError('Please log in');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Upload images first if any
      const imageUrls: string[] = [];
      if (selectedImages.length > 0) {
        // Upload to Supabase storage
        for (const file of selectedImages) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${session.user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          const { data, error: uploadError } = await supabase.storage
            .from('thesis-images')
            .upload(fileName, file);
          
          if (!uploadError && data) {
            const { data: { publicUrl } } = supabase.storage
              .from('thesis-images')
              .getPublicUrl(data.path);
            imageUrls.push(publicUrl);
          }
        }
      }

      const recData: any = {
        ticker,
        action: isWatchlistAdd ? 'WATCH' : action,
        entry_price: isWatchlistAdd ? 0 : parseFloat(entryPrice),
        status: isWatchlistAdd ? 'WATCHLIST' : 'OPEN',
        thesis: thesis || null,
        images: imageUrls.length > 0 ? imageUrls : null,
        price_target: priceTarget ? parseFloat(priceTarget) : null,
        target_date: targetDate || null,
      };

      await createRecommendation(recData, session.user.id);
      
      // Reset form
      setTicker('');
      setEntryPrice('');
      setPriceTarget('');
      setTargetDate('');
      setThesis('');
      setSelectedImages([]);
      setShowAddModal(false);
      
      // Refresh recommendations
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to create recommendation');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (ticker: string) => {
    setExpandedTicker(expandedTicker === ticker ? null : ticker);
  };

  const hasCardWrapper = !className.includes('bg-transparent') && !className.includes('border-0') && !className.includes('rounded-none');
  
  const content = (
    <>
      {/* Header */}
      <div className="p-4 border-b border-[var(--paper-rule)]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-[var(--paper-ink)]">My Stocks</h2>
            <button
              onClick={() => {
                setIsWatchlistAdd(false);
                setShowAddModal(true);
              }}
              className="p-1.5 rounded-md hover:bg-[var(--paper-bg-alt)] transition-colors"
              title="Add Recommendation"
            >
              <Plus className="w-4 h-4 text-[var(--paper-ink)]" />
            </button>
          </div>
          
          {/* View Mode Tabs */}
          <div className="flex gap-1 rounded-lg bg-[var(--paper-bg-alt)] p-1">
            <button
              onClick={() => onViewModeChange('active')}
              className={clsx(
                'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                viewMode === 'active'
                  ? 'bg-[var(--paper-ink)] text-[var(--paper-bg)]'
                  : 'text-[var(--paper-muted)] hover:text-[var(--paper-ink)]'
              )}
            >
              Active
            </button>
            <button
              onClick={() => onViewModeChange('watchlist')}
              className={clsx(
                'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                viewMode === 'watchlist'
                  ? 'bg-[var(--paper-ink)] text-[var(--paper-bg)]'
                  : 'text-[var(--paper-muted)] hover:text-[var(--paper-ink)]'
              )}
            >
              Watchlist
            </button>
            <button
              onClick={() => onViewModeChange('history')}
              className={clsx(
                'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                viewMode === 'history'
                  ? 'bg-[var(--paper-ink)] text-[var(--paper-bg)]'
                  : 'text-[var(--paper-muted)] hover:text-[var(--paper-ink)]'
              )}
            >
              History
            </button>
          </div>
        </div>

        {/* Stock List */}
        <div className="flex-1 overflow-y-auto">
          {uniqueTickers.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-[var(--paper-muted)]">
                No {viewMode === 'active' ? 'active' : viewMode === 'watchlist' ? 'watchlist' : 'closed'} stocks
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--paper-rule-light)]">
              {uniqueTickers.map((rec) => {
                const isSelected = rec.ticker === selectedTicker;
                const isExpanded = expandedTicker === rec.ticker;
                const returnPct = getReturnDisplay(rec);
                const isPositive = returnPct !== null && returnPct >= 0;
                const currencySymbol = getCurrencySymbol(rec.ticker);
                const targets = priceTargets[rec.ticker] || [];

                return (
                  <div key={rec.ticker} className="bg-[var(--paper-bg)]">
                    <button
                      onClick={() => {
                        onSelectTicker(rec.ticker);
                        toggleExpand(rec.ticker);
                      }}
                      className={clsx(
                        'w-full p-4 text-left transition-colors',
                        isSelected
                          ? 'bg-[var(--paper-ink)] text-[var(--paper-bg)]'
                          : 'hover:bg-[var(--paper-bg-alt)] text-[var(--paper-ink)]'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{rec.ticker}</span>
                          {rec.action && (
                            <span className={clsx(
                              'text-xs px-1.5 py-0.5 rounded',
                              rec.action === 'BUY' 
                                ? 'bg-[var(--pos-green)]/20 text-[var(--pos-green)]'
                                : 'bg-[var(--neg-red)]/20 text-[var(--neg-red)]'
                            )}>
                              {rec.action}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {returnPct !== null && (
                            <span
                              className={clsx(
                                'text-xs font-medium',
                                isSelected
                                  ? 'text-[var(--paper-bg)]'
                                  : isPositive
                                  ? 'text-[var(--pos-green)]'
                                  : 'text-[var(--neg-red)]'
                              )}
                            >
                              {isPositive ? '+' : ''}
                              {returnPct.toFixed(2)}%
                            </span>
                          )}
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </div>
                      </div>
                      {rec.current_price && (
                        <div className={clsx(
                          'text-xs',
                          isSelected ? 'text-[var(--paper-bg)] opacity-80' : 'text-[var(--paper-muted)]'
                        )}>
                          {currencySymbol}{rec.current_price.toFixed(2)}
                          {rec.entry_price && (
                            <span className="ml-2">
                              Entry: {currencySymbol}{rec.entry_price.toFixed(2)}
                            </span>
                          )}
                        </div>
                      )}
                    </button>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-3 border-t border-[var(--paper-rule-light)] bg-[var(--paper-bg-alt)]">
                        {/* Thesis */}
                        {rec.thesis && (
                          <div>
                            <h4 className="text-xs font-semibold text-[var(--paper-muted)] uppercase tracking-wide mb-1">
                              Investment Thesis
                            </h4>
                            <p className="text-sm text-[var(--paper-ink)] italic leading-relaxed whitespace-pre-wrap">
                              "{rec.thesis}"
                            </p>
                          </div>
                        )}

                        {/* Price Targets */}
                        {targets.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-[var(--paper-muted)] uppercase tracking-wide mb-2 flex items-center gap-1">
                              <Target className="w-3 h-3" />
                              Price Targets
                            </h4>
                            <div className="space-y-1">
                              {targets.map((target: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between text-sm">
                                  <span className="text-[var(--paper-ink)]">
                                    {currencySymbol}{target.target_price?.toFixed(2)}
                                  </span>
                                  {target.target_date && (
                                    <span className="text-xs text-[var(--paper-muted)] flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {new Date(target.target_date).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Images */}
                        {rec.images && rec.images.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-[var(--paper-muted)] uppercase tracking-wide mb-2">
                              Attachments
                            </h4>
                            <div className="grid grid-cols-3 gap-2">
                              {rec.images.map((img: string, idx: number) => (
                                <a
                                  key={idx}
                                  href={img}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block aspect-video rounded-md overflow-hidden border border-[var(--paper-rule)] hover:border-[var(--paper-ink)] transition-all"
                                >
                                  <img
                                    src={img}
                                    alt={`Attachment ${idx + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Entry/Exit Info */}
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          {rec.entry_date && (
                            <div>
                              <span className="text-[var(--paper-muted)]">Entry Date:</span>
                              <span className="ml-1 text-[var(--paper-ink)]">
                                {new Date(rec.entry_date).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                          {rec.exit_date && (
                            <div>
                              <span className="text-[var(--paper-muted)]">Exit Date:</span>
                              <span className="ml-1 text-[var(--paper-ink)]">
                                {new Date(rec.exit_date).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                          {rec.target_price && (
                            <div>
                              <span className="text-[var(--paper-muted)]">Target:</span>
                              <span className="ml-1 text-[var(--paper-ink)]">
                                {currencySymbol}{rec.target_price.toFixed(2)}
                              </span>
                            </div>
                          )}
                          {rec.stop_loss && (
                            <div>
                              <span className="text-[var(--paper-muted)]">Stop Loss:</span>
                              <span className="ml-1 text-[var(--neg-red)]">
                                {currencySymbol}{rec.stop_loss.toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
    </>
  );

  return (
    <>
      {hasCardWrapper ? (
        <PaperCard padding="none" className={clsx('h-full flex flex-col rounded-lg', className)}>
          {content}
        </PaperCard>
      ) : (
        <div className={clsx('h-full flex flex-col', className)}>
          {content}
        </div>
      )}

      {/* Add Recommendation Modal */}
      {showAddModal && (
        <div className="fixed z-50 inset-0 overflow-y-auto" onClick={() => setShowAddModal(false)}>
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20">
            <div
              className="relative bg-[var(--paper-bg)] border border-[var(--paper-border)] rounded-lg shadow-xl max-w-lg w-full p-6"
              onClick={(e) => e.stopPropagation()}
              style={{ borderRadius: 'var(--paper-radius-lg)' }}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-[var(--paper-ink)]">
                  {isWatchlistAdd ? 'Add to Watchlist' : 'New Recommendation'}
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-[var(--paper-muted)] hover:text-[var(--paper-ink)]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsWatchlistAdd(false)}
                  className={clsx(
                    'flex-1 py-2 text-sm font-medium rounded-md transition-colors',
                    !isWatchlistAdd
                      ? 'bg-[var(--paper-ink)] text-[var(--paper-bg)]'
                      : 'bg-transparent border border-[var(--paper-rule)] text-[var(--paper-muted)]'
                  )}
                >
                  Recommendation
                </button>
                <button
                  type="button"
                  onClick={() => setIsWatchlistAdd(true)}
                  className={clsx(
                    'flex-1 py-2 text-sm font-medium rounded-md transition-colors',
                    isWatchlistAdd
                      ? 'bg-[var(--paper-ink)] text-[var(--paper-bg)]'
                      : 'bg-transparent border border-[var(--paper-rule)] text-[var(--paper-muted)]'
                  )}
                >
                  Watchlist
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-md bg-[var(--neg-red)]/20 border border-[var(--neg-red)]/30 text-[var(--neg-red)] text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Ticker Search */}
                <div className="relative">
                  <label className="block text-sm font-medium text-[var(--paper-ink)] mb-1">
                    Stock Ticker
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--paper-muted)]" />
                    <input
                      type="text"
                      required
                      value={ticker}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-[var(--paper-rule)] rounded-md bg-[var(--paper-bg)] text-[var(--paper-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--paper-ink)]/20"
                      placeholder="Search ticker..."
                    />
                  </div>
                  {searchResults.length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full bg-[var(--paper-bg)] border border-[var(--paper-border)] rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {searchResults.map((res) => (
                        <li
                          key={res.symbol}
                          onClick={() => selectStock(res.symbol)}
                          className="px-3 py-2 hover:bg-[var(--paper-bg-alt)] cursor-pointer text-sm"
                        >
                          <div className="font-medium text-[var(--paper-ink)]">{res.name}</div>
                          <div className="text-xs text-[var(--paper-muted)]">{res.symbol}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {!isWatchlistAdd && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-[var(--paper-ink)] mb-1">
                        Action
                      </label>
                      <select
                        value={action}
                        onChange={(e) => setAction(e.target.value as 'BUY' | 'SELL')}
                        className="w-full px-3 py-2 border border-[var(--paper-rule)] rounded-md bg-[var(--paper-bg)] text-[var(--paper-ink)]"
                      >
                        <option value="BUY">BUY</option>
                        <option value="SELL">SELL</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[var(--paper-ink)] mb-1">
                        Entry Price
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={entryPrice}
                        onChange={(e) => setEntryPrice(e.target.value)}
                        className="w-full px-3 py-2 border border-[var(--paper-rule)] rounded-md bg-[var(--paper-bg)] text-[var(--paper-ink)]"
                        placeholder="0.00"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-[var(--paper-ink)] mb-1">
                    Price Target (Optional)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={priceTarget}
                    onChange={(e) => setPriceTarget(e.target.value)}
                    className="w-full px-3 py-2 border border-[var(--paper-rule)] rounded-md bg-[var(--paper-bg)] text-[var(--paper-ink)]"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--paper-ink)] mb-1">
                    Target Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full px-3 py-2 border border-[var(--paper-rule)] rounded-md bg-[var(--paper-bg)] text-[var(--paper-ink)]"
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--paper-ink)] mb-1">
                    Thesis / Notes
                  </label>
                  <textarea
                    value={thesis}
                    onChange={(e) => setThesis(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-[var(--paper-rule)] rounded-md bg-[var(--paper-bg)] text-[var(--paper-ink)] resize-none"
                    placeholder="What's your rationale for this trade?"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--paper-ink)] mb-1">
                    Attachments
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {selectedImages.map((file, index) => (
                      <div key={index} className="relative w-16 h-16 rounded-md overflow-hidden border border-[var(--paper-rule)]">
                        <img
                          src={URL.createObjectURL(file)}
                          alt="preview"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-0.5 right-0.5 bg-black/50 hover:bg-[var(--neg-red)] rounded-full p-0.5 text-white"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-16 h-16 rounded-md border-2 border-dashed border-[var(--paper-rule)] hover:border-[var(--paper-ink)] flex items-center justify-center text-[var(--paper-muted)]"
                    >
                      <Upload className="w-5 h-5" />
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageSelect}
                      className="hidden"
                      accept="image/*"
                      multiple
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-[var(--paper-rule)]">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-sm font-medium text-[var(--paper-muted)] border border-[var(--paper-rule)] rounded-md hover:bg-[var(--paper-bg-alt)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 text-sm font-medium text-[var(--paper-bg)] bg-[var(--paper-ink)] rounded-md hover:opacity-90 disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : isWatchlistAdd ? 'Add to Watchlist' : 'Save Recommendation'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

