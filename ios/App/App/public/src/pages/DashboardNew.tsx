/**
 * Dashboard Page - Premium Hedge Fund Grade UI
 * 
 * Main dashboard layout featuring:
 * - 12-column responsive grid system
 * - Left panel: Idea List (4 columns / ~33%)
 * - Right panel: Stock Detail (8 columns / ~66%)
 * - Smooth animations and transitions
 * - Mobile-responsive drawer mode
 * 
 * @page
 */

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { searchStocks, getPrice } from '../lib/api';
import { Search, AlertCircle, Upload, X, Menu } from 'lucide-react';
import { IdeaList } from '../components/ideas/IdeaList';
import { StockDetailPanel } from '../components/stock/StockDetailPanel';
import { usePanelWidth, usePanelTransition } from '../hooks/useLayout';
import { getCachedPrice, setCachedPrice, isPriceCacheValid, clearExpiredPrices } from '../lib/priceCache';
import { setCachedReturn, calculateReturn } from '../lib/returnsCache';

// Mock data fallback
const MOCK_STOCKS = [
    { symbol: 'RELIANCE.NS', name: 'Reliance Industries Ltd' },
    { symbol: 'TCS.NS', name: 'Tata Consultancy Services Ltd' },
    { symbol: 'HDFCBANK.NS', name: 'HDFC Bank Ltd' },
    { symbol: 'INFY.NS', name: 'Infosys Ltd' },
    { symbol: 'ICICIBANK.NS', name: 'ICICI Bank Ltd' },
];

export default function DashboardNew() {
    const { session } = useAuth();
    const { isMobile } = usePanelWidth();

    // State
    const [recommendations, setRecommendations] = useState<any[]>([]);
    const [selectedStock, setSelectedStock] = useState<any>(null);
    const [viewMode, setViewMode] = useState<'active' | 'watchlist' | 'history'>('active');
    const [showModal, setShowModal] = useState(false);
    const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    // Form State
    const [ticker, setTicker] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [_hasSearched, setHasSearched] = useState(false);
    const [action, setAction] = useState('BUY');
    const [entryPrice, setEntryPrice] = useState<string>('');
    const [thesis, setThesis] = useState('');
    const [loading, setLoading] = useState(false);
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isWatchlistAdd, setIsWatchlistAdd] = useState(false);
    const [selectedImages, setSelectedImages] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [isLoadingPrices, setIsLoadingPrices] = useState(false);

    // Panel transition hook
    const { shouldRender: shouldRenderDetail, isAnimating: isDetailAnimating } = usePanelTransition(!!selectedStock);

    // Effects
    useEffect(() => {
        if (session?.user) {
            // Clear expired cache entries on mount
            clearExpiredPrices();
            loadRecommendationsWithPrices();
            startPricePolling();
        }
        return () => {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        };
    }, [session]);

    // Close mobile drawer when stock is selected
    useEffect(() => {
        if (selectedStock && isMobile) {
            setIsMobileDrawerOpen(false);
        }
    }, [selectedStock, isMobile]);

    // Data Fetching Functions
    const fetchRecommendations = async () => {
        if (!session?.user) return [];
        try {
            const { data, error } = await supabase
                .from('recommendations')
                .select('*')
                .eq('user_id', session.user.id)
                .order('entry_date', { ascending: false });
            if (error) throw error;
            return data || [];
        } catch (err) {
            console.warn('Could not fetch recommendations', err);
            return [];
        }
    };

    const loadRecommendationsWithPrices = async () => {
        if (!session?.user) return;
        setIsLoadingPrices(true);
        try {
            // First fetch recommendations from DB
            const data = await fetchRecommendations();
            if (!data || data.length === 0) {
                setRecommendations([]);
                setIsLoadingPrices(false);
                return;
            }

            // Then update prices (awaits completion)
            await updatePricesForRecommendations(data);
        } catch (err) {
            console.error("Failed to load recommendations with prices", err);
        } finally {
            setIsLoadingPrices(false);
        }
    };

    const startPricePolling = () => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

        pollIntervalRef.current = setInterval(async () => {
            if (!session?.user) return;
            setRecommendations(prevRecs => {
                // Only update prices for active or watchlist recommendations
                const activeRecs = prevRecs.filter(r => r.status === 'OPEN' || r.status === 'WATCHLIST');
                if (activeRecs.length > 0) {
                    updatePricesForRecommendations(prevRecs);
                }
                return prevRecs;
            });
        }, 60000); // Poll every 60 seconds
    };

    const updatePricesForRecommendations = async (currentRecs: any[]) => {
        if (currentRecs.length === 0) {
            setRecommendations([]);
            return;
        }

        const uniqueTickers = Array.from(new Set(
            currentRecs.filter(r => r.status === 'OPEN' || r.status === 'WATCHLIST').map(r => r.ticker)
        ));

        // First, update recommendations with cached prices immediately (no flash of 0%)
        const cachedUpdates: Record<string, number> = {};
        for (const symbol of uniqueTickers) {
            const cachedPrice = getCachedPrice(symbol);
            if (cachedPrice !== null) {
                cachedUpdates[symbol] = cachedPrice;
            }
        }

        // Start with recommendations, applying cached prices if available
        let updatedRecs = currentRecs.map(rec => {
            if (rec.ticker in cachedUpdates && (rec.status === 'OPEN' || rec.status === 'WATCHLIST')) {
                const cachedPrice = cachedUpdates[rec.ticker];
                const entryPrice = rec.entry_price || 0;

                // Calculate and cache return immediately
                if (entryPrice > 0) {
                    const returnValue = calculateReturn(
                        entryPrice,
                        cachedPrice,
                        rec.action || 'BUY'
                    );
                    setCachedReturn(rec.ticker, entryPrice, returnValue);
                }

                return {
                    ...rec,
                    current_price: cachedPrice,
                    last_updated: new Date().toISOString()
                };
            }
            return rec;
        });

        // Update state with cached prices first
        setRecommendations(updatedRecs);

        // Then, fetch prices only for tickers with expired or missing cache
        const tickersToFetch = uniqueTickers.filter(symbol => !isPriceCacheValid(symbol));

        // Fetch prices in parallel for better performance
        const pricePromises = tickersToFetch.map(async (symbol) => {
            try {
                const priceData = await getPrice(symbol);
                return { symbol, price: priceData.price };
            } catch (e) {
                console.warn(`Failed to update price for ${symbol}`, e);
                return null;
            }
        });

        const priceResults = await Promise.all(pricePromises);

        // Update cache and recommendations with fetched prices
        const finalUpdates: Record<string, number> = {};
        priceResults.forEach(result => {
            if (result) {
                setCachedPrice(result.symbol, result.price);
                finalUpdates[result.symbol] = result.price;
            }
        });

        // Apply fetched prices and calculate returns
        if (Object.keys(finalUpdates).length > 0) {
            setRecommendations(prev => prev.map(rec => {
                if (rec.ticker in finalUpdates && (rec.status === 'OPEN' || rec.status === 'WATCHLIST')) {
                    const newPrice = finalUpdates[rec.ticker];
                    const entryPrice = rec.entry_price || 0;

                    // Calculate and cache return immediately
                    if (entryPrice > 0) {
                        const returnValue = calculateReturn(
                            entryPrice,
                            newPrice,
                            rec.action || 'BUY'
                        );
                        setCachedReturn(rec.ticker, entryPrice, returnValue);
                    }

                    return { ...rec, current_price: newPrice, last_updated: new Date().toISOString() };
                }
                return rec;
            }));
        }
    };

    // Search & Form Handlers
    const handleSearch = async (q: string) => {
        setTicker(q);
        setHasSearched(false);
        if (q.length > 1) {
            setIsSearching(true);
            try {
                let results = await searchStocks(q).catch(() => null);
                if (results && results.length > 0) {
                    setSearchResults(results);
                } else {
                    setSearchResults(MOCK_STOCKS.filter(s =>
                        s.symbol.toLowerCase().includes(q.toLowerCase()) ||
                        s.name.toLowerCase().includes(q.toLowerCase())
                    ));
                }
            } catch (err) {
                setSearchResults([]);
            } finally {
                setIsSearching(false);
                setHasSearched(true);
            }
        } else {
            setSearchResults([]);
        }
    };

    const selectStock = async (symbol: string) => {
        setTicker(symbol);
        setSearchResults([]);
        setHasSearched(false);
        setCurrentPrice(null);
        try {
            const data = await getPrice(symbol);
            setCurrentPrice(data.price);
            setEntryPrice(data.price.toString());
        } catch (e) {
            console.error('Failed to get price', e);
        }
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setSelectedImages(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    const removeImage = (index: number) => {
        setSelectedImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!session?.user) return;
        setLoading(true);
        setError(null);

        try {
            const priceToUse = entryPrice ? parseFloat(entryPrice) : (currentPrice || 0);
            const imageUrls: string[] = [];

            // Upload images
            for (const file of selectedImages) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
                const filePath = `${session.user.id}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('recommendation-images')
                    .upload(filePath, file);

                if (!uploadError) {
                    const { data: { publicUrl } } = supabase.storage
                        .from('recommendation-images')
                        .getPublicUrl(filePath);
                    imageUrls.push(publicUrl);
                }
            }

            const newRec = {
                user_id: session.user.id,
                ticker,
                action: isWatchlistAdd ? 'WATCH' : action,
                entry_price: isWatchlistAdd ? null : priceToUse,
                current_price: priceToUse,
                thesis,
                benchmark_ticker: '^NSEI',
                entry_date: new Date().toISOString(),
                status: isWatchlistAdd ? 'WATCHLIST' : 'OPEN',
                images: imageUrls,
            };

            const { error: sbError } = await supabase.from('recommendations').insert([newRec]);
            if (sbError) throw sbError;

            await fetchRecommendations();
            closeModal();
        } catch (err) {
            console.error('Submission failed', err);
            // Fallback mock
            const mockRec = {
                id: Math.random().toString(36).substr(2, 9),
                user_id: session.user.id,
                ticker,
                action: isWatchlistAdd ? 'WATCH' : action,
                entry_price: isWatchlistAdd ? null : (parseFloat(entryPrice) || 0),
                current_price: parseFloat(entryPrice) || 0,
                thesis,
                entry_date: new Date().toISOString(),
                status: isWatchlistAdd ? 'WATCHLIST' : 'OPEN',
                images: [],
            };
            setRecommendations(prev => [mockRec, ...prev]);
            closeModal();
        } finally {
            setLoading(false);
        }
    };

    // Action Handlers
    const handleCloseIdea = async (rec: any, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!window.confirm(`Close position in ${rec.ticker}?`)) return;

        const exitPrice = rec.current_price || rec.entry_price;
        const ret = rec.entry_price > 0
            ? ((exitPrice - rec.entry_price) / rec.entry_price * 100) * (rec.action === 'SELL' ? -1 : 1)
            : 0;

        try {
            await supabase
                .from('recommendations')
                .update({
                    status: 'CLOSED',
                    exit_price: exitPrice,
                    exit_date: new Date().toISOString(),
                    final_return_pct: ret,
                })
                .eq('id', rec.id);

            setRecommendations(prev => prev.map(r =>
                r.id === rec.id ? { ...r, status: 'CLOSED', exit_price: exitPrice, final_return_pct: ret } : r
            ));
            await fetchRecommendations();
        } catch (err) {
            console.error('Failed to close idea', err);
        }
    };

    const handleDeleteWatchlist = async (rec: any, e: React.MouseEvent) => {
        e.stopPropagation();
        // Watchlist items persist permanently - deletion disabled
        // This function is kept for API compatibility but does nothing
        console.log(`Delete watchlist item disabled - ${rec.ticker} will remain in watchlist`);
    };

    const handlePromoteWatchlist = async (rec: any, actionType: 'BUY' | 'SELL', e: React.MouseEvent) => {
        e.stopPropagation();
        const entryPrice = rec.current_price || 0;
        if (!window.confirm(`Confirm ${actionType} for ${rec.ticker} at ₹${entryPrice.toFixed(2)}?`)) return;

        try {
            // Create a NEW recommendation instead of updating the watchlist item
            // This keeps the watchlist item intact with status 'WATCHLIST'
            const newRec = {
                user_id: session?.user?.id,
                ticker: rec.ticker,
                action: actionType,
                entry_price: entryPrice,
                current_price: entryPrice,
                thesis: rec.thesis || '',
                benchmark_ticker: rec.benchmark_ticker || '^NSEI',
                entry_date: new Date().toISOString(),
                status: 'OPEN',
                images: rec.images || [],
            };

            const { error: sbError } = await supabase.from('recommendations').insert([newRec]);
            if (sbError) throw sbError;

            await fetchRecommendations();
        } catch (err) {
            console.error('Failed to promote', err);
        }
    };

    const closeModal = () => {
        setShowModal(false);
        setTicker('');
        setThesis('');
        setEntryPrice('');
        setCurrentPrice(null);
        setAction('BUY');
        setError(null);
        setSearchResults([]);
        setHasSearched(false);
        setIsWatchlistAdd(false);
        setSelectedImages([]);
    };

    if (!session) {
        return (
            <div className="h-screen flex items-center justify-center bg-slate-900">
                <p className="text-white">Please log in</p>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-4rem)] bg-slate-900 overflow-hidden">
            {/* 12-Column Grid Layout */}
            <div className="h-full grid grid-cols-12">
                {/* Left Panel: Idea List (4 columns on desktop) */}
                <div className={`
                    ${isMobile
                        ? 'fixed inset-y-0 left-0 z-40 w-80 transform transition-transform duration-300 ease-out'
                        : isExpanded
                            ? 'hidden'
                            : 'col-span-12 md:col-span-5 lg:col-span-4 xl:col-span-4'
                    }
                    ${isMobile && !isMobileDrawerOpen ? '-translate-x-full' : 'translate-x-0'}
                `}>
                    <IdeaList
                        isLoading={isLoadingPrices}
                        recommendations={recommendations}
                        selectedStock={selectedStock}
                        setSelectedStock={setSelectedStock}
                        viewMode={viewMode}
                        setViewMode={setViewMode}
                        handleCloseIdea={handleCloseIdea}
                        handlePromoteWatchlist={handlePromoteWatchlist}
                        handleDeleteWatchlist={handleDeleteWatchlist}
                        onNewIdea={() => { setIsWatchlistAdd(false); setShowModal(true); }}
                    />
                </div>

                {/* Mobile Drawer Overlay */}
                {isMobile && isMobileDrawerOpen && (
                    <div
                        className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
                        onClick={() => setIsMobileDrawerOpen(false)}
                    />
                )}

                {/* Right Panel: Stock Detail (8 columns on desktop) */}
                {shouldRenderDetail && selectedStock && (
                    <div className={`
                        ${isMobile
                            ? 'col-span-12'
                            : isExpanded
                                ? 'col-span-12'
                                : 'col-span-12 md:col-span-7 lg:col-span-8 xl:col-span-8'
                        }
                        h-full transition-all duration-300
                        ${isDetailAnimating ? 'opacity-100' : 'opacity-0'}
                    `}>
                        <StockDetailPanel
                            stock={selectedStock}
                            onClose={() => setSelectedStock(null)}
                            isExpanded={isExpanded}
                            onToggleExpand={() => setIsExpanded(!isExpanded)}
                        />
                    </div>
                )}

                {/* Empty State when no stock selected (desktop) */}
                {!selectedStock && !isMobile && (
                    <div className="col-span-12 md:col-span-7 lg:col-span-8 xl:col-span-8 h-full flex items-center justify-center bg-slate-900/50">
                        <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-800/50 flex items-center justify-center">
                                <Search className="w-8 h-8 text-slate-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-white mb-2">Select an idea</h3>
                            <p className="text-sm text-slate-400 max-w-xs">
                                Choose a stock from the list to view detailed analysis and charts.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Mobile Menu Button */}
            {isMobile && !isMobileDrawerOpen && (
                <button
                    onClick={() => setIsMobileDrawerOpen(true)}
                    className="fixed bottom-6 left-6 z-50 p-4 rounded-full bg-indigo-500 text-white
                             shadow-lg shadow-indigo-500/30 hover:bg-indigo-400 transition-colors"
                >
                    <Menu className="w-6 h-6" />
                </button>
            )}

            {/* New Idea Modal */}
            {showModal && (
                <div className="fixed z-50 inset-0 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen p-4">
                        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={closeModal} />

                        <div className="relative bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full border border-white/10 animate-scaleIn">
                            <div className="p-6">
                                {/* Modal Header */}
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-bold text-white">
                                        {isWatchlistAdd ? 'Add to Watchlist' : 'New Recommendation'}
                                    </h3>
                                    <button
                                        onClick={closeModal}
                                        className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Type Toggle */}
                                <div className="flex gap-2 mb-6 p-1 bg-slate-900/50 rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => setIsWatchlistAdd(false)}
                                        className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${!isWatchlistAdd
                                            ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                                            : 'text-slate-400 hover:text-white'
                                            }`}
                                    >
                                        Recommendation
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsWatchlistAdd(true)}
                                        className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${isWatchlistAdd
                                            ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                                            : 'text-slate-400 hover:text-white'
                                            }`}
                                    >
                                        Watchlist
                                    </button>
                                </div>

                                {/* Error */}
                                {error && (
                                    <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4" />
                                        {error}
                                    </div>
                                )}

                                {/* Form */}
                                <form onSubmit={handleSubmit} className="space-y-5">
                                    {/* Ticker Search */}
                                    <div className="relative">
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            Stock Ticker
                                        </label>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                            <input
                                                type="text"
                                                value={ticker}
                                                onChange={(e) => handleSearch(e.target.value)}
                                                placeholder="Search ticker..."
                                                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-white/10 rounded-xl
                                                         text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                                                required
                                            />
                                        </div>

                                        {/* Search Results */}
                                        {(searchResults.length > 0 || isSearching) && ticker.length > 1 && (
                                            <ul className="absolute z-10 mt-1 w-full bg-slate-800 border border-white/10 rounded-xl py-1 max-h-48 overflow-auto shadow-xl">
                                                {isSearching ? (
                                                    <li className="px-4 py-3 text-slate-400 text-sm">Searching...</li>
                                                ) : (
                                                    searchResults.map((res) => (
                                                        <li
                                                            key={res.symbol}
                                                            onClick={() => selectStock(res.symbol)}
                                                            className="px-4 py-2.5 hover:bg-indigo-500/20 cursor-pointer"
                                                        >
                                                            <span className="text-white font-medium">{res.name}</span>
                                                            <span className="text-slate-400 text-xs ml-2">{res.symbol}</span>
                                                        </li>
                                                    ))
                                                )}
                                            </ul>
                                        )}
                                    </div>

                                    {/* Action & Price (not for watchlist) */}
                                    {!isWatchlistAdd && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-300 mb-2">Action</label>
                                                <select
                                                    value={action}
                                                    onChange={(e) => setAction(e.target.value)}
                                                    className="w-full px-4 py-2.5 bg-slate-900/50 border border-white/10 rounded-xl
                                                             text-white focus:outline-none focus:border-indigo-500"
                                                >
                                                    <option value="BUY">BUY</option>
                                                    <option value="SELL">SELL</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-300 mb-2">Entry Price</label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">₹</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={entryPrice}
                                                        onChange={(e) => setEntryPrice(e.target.value)}
                                                        className="w-full pl-8 pr-4 py-2.5 bg-slate-900/50 border border-white/10 rounded-xl
                                                                 text-white focus:outline-none focus:border-indigo-500"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Current Price Display */}
                                    {currentPrice && (
                                        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                                            <span className="text-sm text-emerald-400 flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                                Current Price
                                            </span>
                                            <span className="font-mono font-bold text-emerald-400">₹{currentPrice}</span>
                                        </div>
                                    )}

                                    {/* Thesis */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">Investment Thesis</label>
                                        <textarea
                                            value={thesis}
                                            onChange={(e) => setThesis(e.target.value)}
                                            rows={3}
                                            placeholder="Why are you making this trade?"
                                            className="w-full px-4 py-2.5 bg-slate-900/50 border border-white/10 rounded-xl
                                                     text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                                        />
                                    </div>

                                    {/* Image Upload */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">Attachments</label>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedImages.map((file, index) => (
                                                <div key={index} className="relative w-14 h-14 rounded-lg overflow-hidden group">
                                                    <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                                                    <button
                                                        type="button"
                                                        onClick={() => removeImage(index)}
                                                        className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <X className="w-4 h-4 text-white" />
                                                    </button>
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                className="w-14 h-14 rounded-lg border-2 border-dashed border-slate-600 hover:border-indigo-500 
                                                         flex items-center justify-center text-slate-500 hover:text-indigo-400 transition-colors"
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

                                    {/* Submit */}
                                    <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                                        <button
                                            type="button"
                                            onClick={closeModal}
                                            className="px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-white 
                                                     hover:bg-white/5 rounded-xl transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="px-6 py-2.5 text-sm font-semibold text-white bg-indigo-500 
                                                     hover:bg-indigo-400 rounded-xl transition-colors shadow-lg shadow-indigo-500/25
                                                     disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                        >
                                            {loading ? (
                                                <>
                                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    Saving...
                                                </>
                                            ) : (
                                                isWatchlistAdd ? 'Add to Watchlist' : 'Save Recommendation'
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

