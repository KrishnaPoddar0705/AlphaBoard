/**
 * Dashboard Page - Premium Hedge Fund Grade UI
 * 
 * Main dashboard with responsive 12-column grid layout:
 * - Left panel: 4 columns (~33%) - Idea List
 * - Right panel: 8 columns (~66%) - Stock Detail
 * 
 * Features:
 * - Smooth panel animations
 * - Mobile-responsive drawer mode
 * - Real-time price polling
 * 
 * @page
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useUser } from '@clerk/clerk-react';
import { supabase } from '../lib/supabase';
import { syncClerkUserToSupabase } from '../lib/clerkSupabaseSync';
import { searchStocks, getPrice } from '../lib/api';
import { getVisibleRecommendations } from '../lib/edgeFunctions';
// Removed useOrganization - no longer using team filter
// Removed TeamSelector import - no longer using team filter
import { Search, AlertCircle, Upload, X, Menu } from 'lucide-react';
import { StockDetailPanel } from '../components/stock/StockDetailPanel';
import { IdeaList } from '../components/ideas/IdeaList';
import { PortfolioWeightPanelV2 } from '../components/portfolio/PortfolioWeightPanelV2';
import { usePanelTransition } from '../hooks/useLayout';
import { Settings } from 'lucide-react';
import { getCachedPrice, setCachedPrice, isPriceCacheValid, clearExpiredPrices } from '../lib/priceCache';
import { setCachedReturn, calculateReturn } from '../lib/returnsCache';

// Mock data for fallback
const MOCK_STOCKS = [
    { symbol: 'RELIANCE.NS', name: 'Reliance Industries Ltd' },
    { symbol: 'TCS.NS', name: 'Tata Consultancy Services Ltd' },
    { symbol: 'HDFCBANK.NS', name: 'HDFC Bank Ltd' },
    { symbol: 'HDFCLIFE.NS', name: 'HDFC Life Insurance Company Ltd' },
    { symbol: 'HDFCAMC.NS', name: 'HDFC Asset Management Company Ltd' },
    { symbol: 'INFY.NS', name: 'Infosys Ltd' },
    { symbol: 'ICICIBANK.NS', name: 'ICICI Bank Ltd' },
    { symbol: 'SBIN.NS', name: 'State Bank of India' },
    { symbol: 'BAJFINANCE.NS', name: 'Bajaj Finance Ltd' },
    { symbol: 'BHARTIARTL.NS', name: 'Bharti Airtel Ltd' },
];

export default function Dashboard() {
    const { session } = useAuth();
    const { user: clerkUser } = useUser();
    // Removed organization - no longer using team filter
    // Removed team filter - no longer filtering by team
    const [recommendations, setRecommendations] = useState<any[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [selectedStock, setSelectedStock] = useState<any>(null);
    const [viewMode, setViewMode] = useState<'active' | 'watchlist' | 'history'>('active');
    const [isMobile, setIsMobile] = useState(false);
    const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    // Form State
    const [ticker, setTicker] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [action, setAction] = useState('BUY');
    const [entryPrice, setEntryPrice] = useState<string>('');
    const [thesis, setThesis] = useState('');
    const [loading, setLoading] = useState(false);
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isWatchlistAdd, setIsWatchlistAdd] = useState(false);
    const [selectedImages, setSelectedImages] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showWeightPanel, setShowWeightPanel] = useState(false);
    const [isLoadingPrices, setIsLoadingPrices] = useState(false);
    const [priceTarget, setPriceTarget] = useState<string>('');
    const [targetDate, setTargetDate] = useState<string>('');

    // Ref for polling interval
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Panel transition hook
    const { shouldRender: shouldRenderDetail, isAnimating: isDetailAnimating } = usePanelTransition(!!selectedStock);

    // Detect mobile screen
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Close mobile drawer when stock is selected
    useEffect(() => {
        if (selectedStock && isMobile) {
            setIsMobileDrawerOpen(false);
        }
    }, [selectedStock, isMobile]);

    // Define functions before useEffect that uses them
    const fetchRecommendations = useCallback(async () => {
        const userId = session?.user?.id;
        if (!userId) return [];
        try {
            // Use getVisibleRecommendations without team filter to get all visible recommendations
            // This respects RLS policies (own + team members + admin sees all)
            const response = await getVisibleRecommendations(undefined, undefined);
            return response.recommendations || [];
        } catch (err) {
            console.warn("Could not fetch recommendations", err);
            // Fallback to direct query if Edge Function fails
            try {
                const { data, error } = await supabase
                    .from('recommendations')
                    .select('*')
                    .eq('user_id', userId)
                    .order('entry_date', { ascending: false });
                if (data) return data;
                if (error) throw error;
            } catch (fallbackErr) {
                console.warn("Fallback query also failed", fallbackErr);
            }
            return [];
        }
    }, [session?.user?.id]);

    const loadRecommendationsWithPrices = useCallback(async () => {
        const userId = session?.user?.id;
        if (!userId) return;
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
    }, [session?.user?.id, fetchRecommendations]);

    const startPricePolling = useCallback(() => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

        pollIntervalRef.current = setInterval(async () => {
            const userId = session?.user?.id;
            if (!userId) return;
            setRecommendations(prevRecs => {
                // Only update prices for active or watchlist recommendations
                const activeRecs = prevRecs.filter(r => r.status === 'OPEN' || r.status === 'WATCHLIST');
                if (activeRecs.length > 0) {
                    updatePricesForRecommendations(prevRecs);
                }
                return prevRecs;
            });
        }, 60000); // Poll every 60 seconds
    }, [session?.user?.id]);

    useEffect(() => {
        const userId = session?.user?.id;
        if (!userId) {
            // Clear interval if no user
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
            return;
        }

        // Clear expired cache entries on mount
        clearExpiredPrices();
        loadRecommendationsWithPrices();
        startPricePolling();

        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
        };
    }, [session?.user?.id, loadRecommendationsWithPrices, startPricePolling]); // Depend on stable function references

    const updatePricesForRecommendations = async (currentRecs: any[]) => {
        if (currentRecs.length === 0) {
            setRecommendations([]);
            return;
        }

        const uniqueTickers = Array.from(new Set(currentRecs.filter(r => r.status === 'OPEN' || r.status === 'WATCHLIST').map(r => r.ticker)));

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

                    return {
                        ...rec,
                        current_price: newPrice,
                        last_updated: new Date().toISOString()
                    };
                }
                return rec;
            }));
        }
    };

    const handleSearch = async (q: string) => {
        setTicker(q);
        setHasSearched(false);
        if (q.length > 1) {
            setIsSearching(true);
            try {
                let results;
                try { results = await searchStocks(q); } catch (e) { results = null; }

                if (results && results.length > 0) {
                    setSearchResults(results);
                } else {
                    const mockResults = MOCK_STOCKS.filter(s =>
                        s.symbol.toLowerCase().includes(q.toLowerCase()) ||
                        s.name.toLowerCase().includes(q.toLowerCase())
                    );
                    setSearchResults(mockResults);
                }
            } catch (err) {
                console.warn("Search failed", err);
                setSearchResults([]);
            } finally {
                setIsSearching(false);
                setHasSearched(true);
            }
        } else {
            setSearchResults([]);
            setIsSearching(false);
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
            console.error("Failed to get price", e);
            setCurrentPrice(null);
        }
    };


    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            setSelectedImages(prev => [...prev, ...files]);
        }
    };

    const removeImage = (index: number) => {
        setSelectedImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Ensure Clerk user is authenticated
        if (!clerkUser) {
            setError('Please sign in to create recommendations.');
            return;
        }

        // Ensure user is synced with Supabase before creating recommendation
        let supabaseUserId: string | null = session?.user?.id || null;

        if (!supabaseUserId) {
            // No Supabase user ID yet - sync Clerk user to Supabase
            setLoading(true);
            setError('Syncing user account...');

            try {
                const syncResult = await syncClerkUserToSupabase(clerkUser);
                if (syncResult && syncResult.userId) {
                    supabaseUserId = syncResult.userId;
                    // Wait a moment for session to be established
                    await new Promise(resolve => setTimeout(resolve, 500));
                } else {
                    // Try to get user ID from mapping table
                    const { getSupabaseUserIdForClerkUser } = await import('../lib/clerkSupabaseSync');
                    const mappedId = await getSupabaseUserIdForClerkUser(clerkUser.id);
                    if (mappedId) {
                        supabaseUserId = mappedId;
                    }
                }

                if (!supabaseUserId) {
                    setError('Failed to sync user account. Please refresh the page and try again.');
                    setLoading(false);
                    return;
                }
            } catch (syncError) {
                console.error('Error syncing user:', syncError);
                setError('Failed to sync user account. Please refresh the page and try again.');
                setLoading(false);
                return;
            }
        }

        // Ensure we have a valid user ID before proceeding
        if (!supabaseUserId) {
            setError('User ID not available. Please refresh the page and try again.');
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const priceToUse = entryPrice ? parseFloat(entryPrice) : (currentPrice || 0);

            // Upload images if any
            const imageUrls: string[] = [];
            if (selectedImages.length > 0) {
                for (const file of selectedImages) {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
                    const filePath = `${supabaseUserId}/${fileName}`;

                    // Ensure bucket exists or just try upload (assuming 'recommendation-images' exists)
                    const { error: uploadError } = await supabase.storage
                        .from('recommendation-images')
                        .upload(filePath, file);

                    if (uploadError) {
                        console.warn('Image upload failed', uploadError);
                        // Continue or throw? Let's log and continue for now, maybe partial success
                        continue;
                    }

                    const { data: { publicUrl } } = supabase.storage
                        .from('recommendation-images')
                        .getPublicUrl(filePath);

                    imageUrls.push(publicUrl);
                }
            }

            const newRec: any = {
                user_id: supabaseUserId,
                ticker,
                action: isWatchlistAdd ? 'WATCH' : action,
                entry_price: isWatchlistAdd ? null : priceToUse, // Watchlist items may not have entry price
                current_price: priceToUse,
                thesis,
                benchmark_ticker: "^NSEI",
                entry_date: new Date().toISOString(),
                status: isWatchlistAdd ? 'WATCHLIST' : 'OPEN',
                images: imageUrls,
                // price_target and target_date are handled separately via the API
                price_target: priceTarget ? parseFloat(priceTarget) : null,
                target_date: targetDate ? new Date(targetDate).toISOString() : null
            };

            // Use API endpoint to create recommendation
            try {
                const { createRecommendation } = await import('../lib/api');
                await createRecommendation(newRec, supabaseUserId);
            } catch (apiError: any) {
                // If API fails, fallback to direct Supabase insert
                // Remove price_target and target_date for direct insert since they're not in recommendations table
                const { price_target, target_date, ...recWithoutPriceTarget } = newRec;
                console.warn('API create failed, using direct insert:', apiError);
                const { error: sbError } = await supabase.from('recommendations').insert([recWithoutPriceTarget]);
                if (sbError) throw sbError;

                // If we had a price target, create it separately
                if (price_target) {
                    try {
                        const { createPriceTarget } = await import('../lib/api');
                        await createPriceTarget(ticker, price_target, target_date, supabaseUserId);
                    } catch (ptError) {
                        console.warn('Failed to create price target in fallback:', ptError);
                    }
                }
            }

            await fetchRecommendations();

            // Trigger refresh of weight panel if it's open
            window.dispatchEvent(new Event('recommendations-updated'));

            closeModal();
        } catch (err) {
            console.error("Submission failed", err);
            // Fallback for demo (shouldn't be needed if sync worked)
            if (!supabaseUserId) {
                setError('Failed to create recommendation. Please ensure you are signed in.');
                setLoading(false);
                return;
            }
            const mockRec = {
                id: Math.random().toString(36).substr(2, 9),
                user_id: supabaseUserId,
                ticker,
                action: isWatchlistAdd ? 'WATCH' : action,
                entry_price: isWatchlistAdd ? null : (parseFloat(entryPrice) || 0),
                current_price: parseFloat(entryPrice) || 0,
                thesis,
                entry_date: new Date().toISOString(),
                status: isWatchlistAdd ? 'WATCHLIST' : 'OPEN',
                images: [] as string[]
            };
            setRecommendations(prev => [mockRec, ...prev]);
            closeModal();
        } finally {
            setLoading(false);
        }
    };

    const handleCloseIdea = async (rec: any, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!window.confirm(`Are you sure you want to close your position in ${rec.ticker}?`)) return;

        const currentPriceVal = typeof rec.current_price === 'number' ? rec.current_price : parseFloat(rec.current_price);
        const entryPriceVal = typeof rec.entry_price === 'number' ? rec.entry_price : parseFloat(rec.entry_price);

        const exitPrice = (!isNaN(currentPriceVal) && currentPriceVal > 0) ? currentPriceVal : entryPriceVal;
        const ret = entryPriceVal > 0 ? ((exitPrice - entryPriceVal) / entryPriceVal * 100) * (rec.action === 'SELL' ? -1 : 1) : 0;

        try {
            const { error } = await supabase
                .from('recommendations')
                .update({
                    status: 'CLOSED',
                    exit_price: exitPrice,
                    exit_date: new Date().toISOString(),
                    final_return_pct: ret
                })
                .eq('id', rec.id)
                .select();

            if (error) throw error;

            // Explicitly update local state to remove from active view
            setRecommendations(prev => prev.map(r => {
                if (r.id === rec.id) {
                    return {
                        ...r,
                        status: 'CLOSED',
                        exit_price: exitPrice,
                        exit_date: new Date().toISOString(),
                        final_return_pct: ret
                    };
                }
                return r;
            }));

            // Refetch to be absolutely sure
            await fetchRecommendations();
        } catch (err) {
            console.error("Failed to close idea", err);
            // Optimistic update still useful here
            setRecommendations(prev => prev.map(r => {
                if (r.id === rec.id) {
                    return { ...r, status: 'CLOSED', exit_price: exitPrice, exit_date: new Date().toISOString(), final_return_pct: ret };
                }
                return r;
            }));
        }
    };

    const handleDeleteWatchlist = async (rec: any, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!window.confirm(`Remove ${rec.ticker} from watchlist?`)) return;

        try {
            const { error } = await supabase
                .from('recommendations')
                .delete()
                .eq('id', rec.id)
                .select();

            if (error) throw error;

            setRecommendations(prev => prev.filter(r => r.id !== rec.id));
        } catch (err) {
            console.error("Failed to delete watchlist item", err);
            // Optimistic
            setRecommendations(prev => prev.filter(r => r.id !== rec.id));
        }
    };

    const [promoteModalOpen, setPromoteModalOpen] = useState(false);
    const [promoteRec, setPromoteRec] = useState<any>(null);
    const [promoteAction, setPromoteAction] = useState<'BUY' | 'SELL'>('BUY');
    const [promoteThesis, setPromoteThesis] = useState('');
    const [promoteImages, setPromoteImages] = useState<File[]>([]);
    const [promotePriceTarget, setPromotePriceTarget] = useState<string>('');
    const [promoteTargetDate, setPromoteTargetDate] = useState<string>('');
    const promoteFileInputRef = useRef<HTMLInputElement>(null);

    const handlePromoteWatchlist = async (rec: any, actionType: 'BUY' | 'SELL', e: React.MouseEvent) => {
        e.stopPropagation();
        // Open modal for thesis, screenshots, and price targets
        setPromoteRec(rec);
        setPromoteAction(actionType);
        setPromoteThesis(rec.thesis || '');
        setPromoteImages([]);
        setPromotePriceTarget('');
        setPromoteTargetDate('');
        setPromoteModalOpen(true);
    };

    const handlePromoteSubmit = async () => {
        if (!promoteRec) return;
        if (!promoteThesis.trim()) {
            setError('Thesis is required');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const entryPrice = promoteRec.current_price || 0;

            // Upload images if any
            const imageUrls: string[] = [];
            if (promoteImages.length > 0) {
                for (const file of promoteImages) {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
                    const filePath = `${session?.user?.id}/${fileName}`;

                    const { error: uploadError } = await supabase.storage
                        .from('recommendation-images')
                        .upload(filePath, file);

                    if (uploadError) {
                        console.warn('Image upload failed', uploadError);
                        continue;
                    }

                    const { data: { publicUrl } } = supabase.storage
                        .from('recommendation-images')
                        .getPublicUrl(filePath);

                    imageUrls.push(publicUrl);
                }
            }

            // Combine existing images with new ones
            const allImages = [...(promoteRec.images || []), ...imageUrls];

            const updateData: any = {
                status: 'OPEN',
                action: promoteAction,
                entry_price: entryPrice,
                entry_date: new Date().toISOString(),
                thesis: promoteThesis,
                images: allImages
            };

            const { error } = await supabase
                .from('recommendations')
                .update(updateData)
                .eq('id', promoteRec.id);

            if (error) throw error;

            // Create price target if provided
            if (promotePriceTarget) {
                try {
                    const { createPriceTarget } = await import('../lib/api');
                    await createPriceTarget(
                        promoteRec.ticker,
                        parseFloat(promotePriceTarget),
                        promoteTargetDate ? new Date(promoteTargetDate).toISOString() : null,
                        session?.user?.id || ''
                    );
                } catch (ptError) {
                    console.warn('Failed to create price target:', ptError);
                }
            }

            await fetchRecommendations();
            window.dispatchEvent(new Event('recommendations-updated'));
            setPromoteModalOpen(false);
            setPromoteRec(null);
        } catch (err: any) {
            console.error("Promotion failed", err);
            setError(err.message || 'Failed to promote watchlist item');
        } finally {
            setLoading(false);
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
        setPriceTarget('');
        setTargetDate('');
    };

    if (!session) return (
        <div className="h-screen flex items-center justify-center bg-slate-900">
            <p className="text-white">Please log in</p>
        </div>
    );

    return (
        <div className="h-[calc(100vh-4rem)] bg-slate-900 overflow-hidden">
            {/* 12-Column Responsive Grid Layout */}
            <div className="h-full grid grid-cols-12">
                {/* Left Panel: Idea List or Performance Metrics - 5 columns on desktop */}
                <div className={`
                    ${isMobile
                        ? 'fixed inset-y-0 left-0 z-40 w-96 transform transition-transform duration-300 ease-out'
                        : isExpanded
                            ? 'hidden'
                            : 'col-span-12 md:col-span-6 lg:col-span-5 xl:col-span-5'
                    }
                    ${isMobile && !isMobileDrawerOpen ? '-translate-x-full' : 'translate-x-0'}
                    h-full overflow-hidden flex flex-col bg-slate-900
                `}>
                    {/* Content */}
                    <div className="flex-1 overflow-y-auto relative">
                        {/* Weight Panel Toggle Button */}
                        {session?.user && (
                            <div className="p-3 border-b border-white/10">
                                <button
                                    onClick={() => setShowWeightPanel(!showWeightPanel)}
                                    className="w-full px-3 py-2 text-sm font-medium text-gray-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    <Settings className="w-4 h-4" />
                                    {showWeightPanel ? 'Hide' : 'Show'} Portfolio Weights
                                </button>
                            </div>
                        )}
                        {/* Team filter removed */}
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
                </div>

                {/* Mobile Drawer Overlay */}
                {isMobile && isMobileDrawerOpen && (
                    <div
                        className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm animate-fadeIn"
                        onClick={() => setIsMobileDrawerOpen(false)}
                    />
                )}

                {/* Right Panel: Stock Detail - 8 columns on desktop */}
                {shouldRenderDetail && selectedStock && (
                    <div className={`
                        ${isMobile
                            ? 'col-span-12'
                            : isExpanded
                                ? 'col-span-12'
                                : 'col-span-12 md:col-span-6 lg:col-span-7 xl:col-span-7'
                        }
                        h-full relative transition-all duration-300
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

                {/* Empty State when no stock selected (desktop only) */}
                {!selectedStock && !isMobile && (
                    <div className="col-span-12 md:col-span-6 lg:col-span-7 xl:col-span-7 h-full flex items-center justify-center bg-slate-900/50">
                        <div className="text-center animate-fadeIn">
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
                <div className="fixed z-50 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={closeModal}></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                        <div className="inline-block align-bottom bg-[#1e293b] rounded-2xl text-left overflow-visible shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-white/10 relative">
                            <div className="px-6 py-6">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-bold text-white">
                                        {isWatchlistAdd ? 'Add to Watchlist' : 'New Recommendation'}
                                    </h3>
                                    <button onClick={closeModal} className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-full">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="mb-6 flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsWatchlistAdd(false)}
                                        className={`flex-1 py-2 text-sm font-medium rounded-lg border ${!isWatchlistAdd ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-transparent border-white/10 text-gray-400'}`}
                                    >
                                        Recommendation
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsWatchlistAdd(true)}
                                        className={`flex-1 py-2 text-sm font-medium rounded-lg border ${isWatchlistAdd ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-transparent border-white/10 text-gray-400'}`}
                                    >
                                        Watchlist
                                    </button>
                                </div>

                                {error && (
                                    <div className="mb-4 p-3 rounded bg-red-500/20 border border-red-500/30 text-red-200 text-sm flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4" />
                                        {error}
                                    </div>
                                )}
                                <form onSubmit={handleSubmit} className="space-y-5">
                                    <div className="relative">
                                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Stock Ticker</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Search className={`h-4 w-4 ${hasSearched && searchResults.length === 0 ? 'text-red-400' : 'text-gray-400'} group-focus-within:text-indigo-400 transition-colors`} />
                                            </div>
                                            <input
                                                type="text"
                                                required
                                                value={ticker}
                                                onChange={(e) => handleSearch(e.target.value)}
                                                className={`block w-full pl-10 pr-3 py-2.5 border rounded-lg leading-5 bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all
                            ${hasSearched && searchResults.length === 0 && ticker.length > 1
                                                        ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500'
                                                        : 'border-white/10 focus:ring-indigo-500/50 focus:border-indigo-500'}`}
                                                placeholder="Search ticker (e.g. RELIANCE)"
                                                autoComplete="off"
                                            />
                                        </div>
                                        {hasSearched && searchResults.length === 0 && ticker.length > 1 && (
                                            <div className="absolute right-0 top-0 text-xs text-red-400 font-medium flex items-center mt-8 mr-2 pointer-events-none">
                                                Ticker incorrect
                                            </div>
                                        )}
                                        {(searchResults.length > 0 || isSearching) && ticker.length > 1 && (
                                            <ul className="absolute z-50 mt-1 w-full bg-[#1e293b] border border-white/10 shadow-2xl max-h-60 rounded-lg py-1 text-base overflow-auto focus:outline-none sm:text-sm animate-fadeIn">
                                                {isSearching ? (
                                                    <li className="px-4 py-3 text-gray-400 text-sm text-center">Searching...</li>
                                                ) : (
                                                    searchResults.map((res) => (
                                                        <li
                                                            key={res.symbol}
                                                            className="cursor-pointer select-none relative py-2.5 pl-3 pr-9 text-white hover:bg-indigo-600 transition-colors border-b border-white/5 last:border-0 group"
                                                            onClick={() => selectStock(res.symbol)}
                                                        >
                                                            <div className="flex flex-col">
                                                                <span className="font-medium text-blue-200 group-hover:text-white transition-colors">{res.name}</span>
                                                                <span className="text-xs text-gray-400 group-hover:text-white/70 transition-colors font-mono">{res.symbol}</span>
                                                            </div>
                                                        </li>
                                                    ))
                                                )}
                                            </ul>
                                        )}
                                    </div>

                                    {!isWatchlistAdd && (
                                        <div className="grid grid-cols-1 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-1.5">Action</label>
                                                <select
                                                    value={action}
                                                    onChange={(e) => setAction(e.target.value)}
                                                    className="block w-full px-3 py-2.5 border border-white/10 bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 sm:text-sm rounded-lg appearance-none cursor-pointer hover:bg-white/10 transition-colors"
                                                >
                                                    <option value="BUY" className="bg-[#1e293b]">BUY</option>
                                                    <option value="SELL" className="bg-[#1e293b]">SELL</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-1.5">Entry Price</label>
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                        <span className="text-gray-400 sm:text-sm">₹</span>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        required={!isWatchlistAdd}
                                                        value={entryPrice}
                                                        onChange={(e) => setEntryPrice(e.target.value)}
                                                        className="block w-full pl-7 pr-3 py-2.5 border border-white/10 rounded-lg bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 sm:text-sm transition-all"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-1.5">Price Target (Optional)</label>
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                        <span className="text-gray-400 sm:text-sm">₹</span>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={priceTarget}
                                                        onChange={(e) => setPriceTarget(e.target.value)}
                                                        className="block w-full pl-7 pr-3 py-2.5 border border-white/10 rounded-lg bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 sm:text-sm transition-all"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-1.5">Time Horizon (Optional)</label>
                                                <input
                                                    type="date"
                                                    value={targetDate}
                                                    onChange={(e) => setTargetDate(e.target.value)}
                                                    className="block w-full px-3 py-2.5 border border-white/10 rounded-lg bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 sm:text-sm transition-all"
                                                    min={new Date().toISOString().split('T')[0]}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {currentPrice ? (
                                        <>
                                            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-300 flex items-center justify-between animate-fadeIn">
                                                <span className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                                    Current Market Price
                                                </span>
                                                <span className="font-mono font-bold">₹{currentPrice}</span>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-400 flex items-center justify-between">
                                            <span>Fetch price by searching...</span>
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Thesis / Notes</label>
                                        <textarea
                                            value={thesis}
                                            onChange={(e) => setThesis(e.target.value)}
                                            rows={3}
                                            className="block w-full py-2.5 px-3 border border-white/10 rounded-lg bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 sm:text-sm transition-all resize-none"
                                            placeholder="What's your rationale for this trade?"
                                        />
                                    </div>

                                    {/* Image Upload Section */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Attachments</label>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedImages.map((file, index) => (
                                                <div key={index} className="relative w-16 h-16 rounded-lg overflow-hidden border border-white/10 group">
                                                    <img
                                                        src={URL.createObjectURL(file)}
                                                        alt="preview"
                                                        className="w-full h-full object-cover"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => removeImage(index)}
                                                        className="absolute top-0.5 right-0.5 bg-black/50 hover:bg-red-500 rounded-full p-0.5 text-white opacity-0 group-hover:opacity-100 transition-all"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                className="w-16 h-16 rounded-lg border-2 border-dashed border-white/20 hover:border-indigo-500/50 flex flex-col items-center justify-center text-gray-400 hover:text-indigo-400 hover:bg-white/5 transition-all"
                                            >
                                                <Upload className="w-5 h-5 mb-1" />
                                                <span className="text-[10px]">Add</span>
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

                                    <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-white/10">
                                        <button
                                            type="button"
                                            onClick={closeModal}
                                            className="px-4 py-2 text-sm font-medium text-gray-300 bg-transparent border border-white/10 rounded-lg hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/20 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-lg shadow-indigo-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                        >
                                            {loading ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                    Saving...
                                                </>
                                            ) : (isWatchlistAdd ? 'Add to Watchlist' : 'Save Recommendation')}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Portfolio Weight Panel */}
            {session?.user && (
                <PortfolioWeightPanelV2
                    userId={session.user.id}
                    isOpen={showWeightPanel}
                    onClose={() => setShowWeightPanel(false)}
                    onUpdate={() => {
                        fetchRecommendations();
                    }}
                />
            )}

            {/* Promote Watchlist Modal */}
            {promoteModalOpen && promoteRec && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#1e293b] rounded-xl shadow-2xl border border-white/10 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-white/10">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-white">
                                    Promote {promoteRec.ticker} to {promoteAction} Recommendation
                                </h2>
                                <button
                                    onClick={() => {
                                        setPromoteModalOpen(false);
                                        setPromoteRec(null);
                                        setError(null);
                                    }}
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-5">
                            {error && (
                                <div className="p-3 rounded bg-red-500/20 border border-red-500/30 text-red-200 text-sm flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" />
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                                    Entry Price
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <span className="text-gray-400 sm:text-sm">₹</span>
                                    </div>
                                    <input
                                        type="text"
                                        value={promoteRec.current_price ? `₹${promoteRec.current_price.toFixed(2)}` : 'N/A'}
                                        disabled
                                        className="block w-full pl-7 pr-3 py-2.5 border border-white/10 rounded-lg bg-white/5 text-gray-400 sm:text-sm"
                                    />
                                </div>
                                <p className="mt-1 text-xs text-gray-500">Using current market price as entry price</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                                    Thesis / Notes <span className="text-red-400">*</span>
                                </label>
                                <textarea
                                    value={promoteThesis}
                                    onChange={(e) => setPromoteThesis(e.target.value)}
                                    rows={4}
                                    required
                                    className="block w-full py-2.5 px-3 border border-white/10 rounded-lg bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 sm:text-sm transition-all resize-none"
                                    placeholder="What's your rationale for this trade?"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                                    Price Target (Optional)
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <span className="text-gray-400 sm:text-sm">₹</span>
                                    </div>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={promotePriceTarget}
                                        onChange={(e) => setPromotePriceTarget(e.target.value)}
                                        className="block w-full pl-7 pr-3 py-2.5 border border-white/10 rounded-lg bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 sm:text-sm transition-all"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                                    Target Date (Optional)
                                </label>
                                <input
                                    type="date"
                                    value={promoteTargetDate}
                                    onChange={(e) => setPromoteTargetDate(e.target.value)}
                                    className="block w-full px-3 py-2.5 border border-white/10 rounded-lg bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 sm:text-sm transition-all"
                                    min={new Date().toISOString().split('T')[0]}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                                    Screenshots / Attachments (Optional)
                                </label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {promoteImages.map((file, index) => (
                                        <div key={index} className="relative w-16 h-16 rounded-lg overflow-hidden border border-white/10 group">
                                            <img
                                                src={URL.createObjectURL(file)}
                                                alt="preview"
                                                className="w-full h-full object-cover"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setPromoteImages(prev => prev.filter((_, i) => i !== index))}
                                                className="absolute top-0.5 right-0.5 bg-black/50 hover:bg-red-500 rounded-full p-0.5 text-white opacity-0 group-hover:opacity-100 transition-all"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <input
                                    ref={promoteFileInputRef}
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={(e) => {
                                        if (e.target.files) {
                                            setPromoteImages(prev => [...prev, ...Array.from(e.target.files || [])]);
                                        }
                                    }}
                                    className="hidden"
                                />
                                <button
                                    type="button"
                                    onClick={() => promoteFileInputRef.current?.click()}
                                    className="w-full px-4 py-2 border border-white/10 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Upload className="w-4 h-4" />
                                    Upload Images
                                </button>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPromoteModalOpen(false);
                                        setPromoteRec(null);
                                        setError(null);
                                    }}
                                    className="px-4 py-2 text-sm text-gray-300 bg-transparent border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handlePromoteSubmit}
                                    disabled={loading || !promoteThesis.trim()}
                                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Promoting...' : `Promote to ${promoteAction}`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
