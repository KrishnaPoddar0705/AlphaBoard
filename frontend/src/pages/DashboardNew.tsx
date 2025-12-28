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

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useUser } from '@clerk/clerk-react';
import { supabase } from '../lib/supabase';
import { searchStocks, getPrice } from '../lib/api';
import { Search, AlertCircle, Upload, X, Plus, User, Moon } from 'lucide-react';
import { IdeaList } from '../components/ideas/IdeaList';
import { StockDetailPanel } from '../components/stock/StockDetailPanel';
import { IdeaCardMobile } from '../components/ideas/IdeaCardMobile';
import { usePanelWidth, usePanelTransition } from '../hooks/useLayout';
import { getCachedPrice, setCachedPrice, isPriceCacheValid, clearExpiredPrices } from '../lib/priceCache';
import { setCachedReturn, calculateReturn, getReturnFromCacheOrCalculate } from '../lib/returnsCache';
import { getRollingPortfolioReturns } from '../lib/api';
import toast, { Toaster } from 'react-hot-toast';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { getStockSummary } from '../lib/api';
import { WeeklyReturnsChart } from '../components/charts/WeeklyReturnsChart';
import { TopPerformersChart } from '../components/charts/TopPerformersChart';
import { PortfolioAllocationDonut } from '../components/charts/PortfolioAllocationDonut';
import { MonthlyPnLChart } from '../components/charts/MonthlyPnLChart';
import { KPIMiniChart } from '../components/charts/KPIMiniChart';
import { IdeasAddedChart } from '../components/charts/IdeasAddedChart';

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
    const { user: clerkUser } = useUser();
    const { isMobile } = usePanelWidth();

    // Initialize mobile state immediately to avoid hydration issues
    const [isMobileState, setIsMobileState] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.innerWidth < 768;
        }
        return false;
    });

    // Ensure mobile detection works on first render and updates
    useEffect(() => {
        const checkMobile = () => {
            const width = window.innerWidth;
            setIsMobileState(width < 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Use state-based mobile detection for rendering (prioritize hook, fallback to state)
    const isMobileView = isMobile !== undefined ? isMobile : isMobileState;

    // State
    const [recommendations, setRecommendations] = useState<any[]>([]);
    const [selectedStock, setSelectedStock] = useState<any>(null);
    const [viewMode, setViewMode] = useState<'active' | 'watchlist' | 'history'>('active');
    const [showModal, setShowModal] = useState(false);
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
    const [selectedMarket, setSelectedMarket] = useState<'IN' | 'US'>('IN'); // Track market for currency display
    const [buyPrice, setBuyPrice] = useState<string>('');
    const [sellPrice, setSellPrice] = useState<string>('');
    const [priceTarget, setPriceTarget] = useState<string>('');
    const [targetDate, setTargetDate] = useState<string>('');
    const [selectedImages, setSelectedImages] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [isLoadingPrices, setIsLoadingPrices] = useState(false);
    const [companyNames, setCompanyNames] = useState<Record<string, string>>({});
    const [ideasAddedPeriod, setIdeasAddedPeriod] = useState<'day' | 'week' | 'month'>('week');
    const [topPerformersPeriod, setTopPerformersPeriod] = useState<'day' | 'week' | 'month'>('week');
    const [portfolioReturnsPeriod, setPortfolioReturnsPeriod] = useState<'day' | 'week' | 'month'>('week');
    const [portfolioReturnsLoading, setPortfolioReturnsLoading] = useState(false);

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

    // Close stock detail when navigating away on mobile
    useEffect(() => {
        // Stock detail is handled by full-screen overlay on mobile
    }, [selectedStock, isMobileView]);

    // Fetch company names for displayed recommendations
    useEffect(() => {
        const fetchCompanyNames = async () => {
            const displayedRecs = recommendations.filter(rec => {
                if (viewMode === 'active') return rec.status === 'OPEN';
                if (viewMode === 'watchlist') return rec.status === 'WATCHLIST';
                if (viewMode === 'history') return rec.status === 'CLOSED';
                return false;
            });

            const tickersToFetch = displayedRecs
                .map(rec => rec.ticker)
                .filter(ticker => !companyNames[ticker]);

            if (tickersToFetch.length === 0) return;

            const namePromises = tickersToFetch.map(async (ticker) => {
                try {
                    const summary = await getStockSummary(ticker);
                    return { ticker, name: summary?.companyName || null };
                } catch (error) {
                    console.warn(`Failed to fetch company name for ${ticker}:`, error);
                    return { ticker, name: null };
                }
            });

            const results = await Promise.all(namePromises);
            const newNames: Record<string, string> = {};

            results.forEach(({ ticker, name }) => {
                if (name) {
                    newNames[ticker] = name;
                }
            });

            if (Object.keys(newNames).length > 0) {
                setCompanyNames(prev => ({ ...prev, ...newNames }));
            }
        };

        if (recommendations.length > 0) {
            fetchCompanyNames();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recommendations, viewMode]);

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

                // Check for price alerts (only for watchlist items with buy_price or sell_price)
                if (rec.status === 'WATCHLIST' && session?.user?.id) {
                    checkAndCreateAlerts(rec, cachedPrice);
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

                    // Check for price alerts (only for watchlist items with buy_price or sell_price)
                    if (rec.status === 'WATCHLIST' && session?.user?.id) {
                        checkAndCreateAlerts(rec, newPrice);
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

        // Auto-detect market from typed ticker if no suffix
        if (q.length > 0 && !q.includes('.NS') && !q.includes('.BO') && !q.includes('.')) {
            // If it's a plain ticker without suffix, assume US market for now
            // User can select from dropdown to confirm
            setSelectedMarket('US');
        } else if (q.includes('.NS') || q.includes('.BO')) {
            setSelectedMarket('IN');
        }

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
        // Clear entry price when selecting a new stock
        setEntryPrice('');

        // Determine market from symbol
        const isUS = !symbol.includes('.NS') && !symbol.includes('.BO');
        setSelectedMarket(isUS ? 'US' : 'IN');

        try {
            const data = await getPrice(symbol);
            setCurrentPrice(data.price);
            // Set entry price to current price
            setEntryPrice(data.price.toString());
        } catch (e) {
            console.error('Failed to get price', e);
        }
    };

    // Helper to get currency symbol
    const getCurrencySymbol = () => selectedMarket === 'US' ? '$' : '₹';

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

            // Determine benchmark based on market (US stocks use S&P 500, Indian stocks use NSE)
            const benchmarkTicker = selectedMarket === 'US' ? '^GSPC' : '^NSEI';

            const newRec: any = {
                user_id: session.user.id,
                ticker,
                action: isWatchlistAdd ? 'WATCH' : action,
                entry_price: isWatchlistAdd ? null : priceToUse,
                current_price: priceToUse,
                buy_price: isWatchlistAdd && buyPrice ? parseFloat(buyPrice) : null,
                sell_price: isWatchlistAdd && sellPrice ? parseFloat(sellPrice) : null,
                thesis,
                benchmark_ticker: benchmarkTicker,
                entry_date: new Date().toISOString(),
                status: isWatchlistAdd ? 'WATCHLIST' : 'OPEN',
                images: imageUrls,
                price_target: priceTarget ? parseFloat(priceTarget) : null,
                target_date: targetDate ? new Date(targetDate).toISOString() : null
            };

            // Use API endpoint to create recommendation
            try {
                const { createRecommendation } = await import('../lib/api');
                await createRecommendation(newRec, session.user.id);
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
                        await createPriceTarget(
                            ticker,
                            price_target,
                            target_date,
                            session.user.id
                        );
                    } catch (ptError) {
                        console.warn('Failed to create price target in fallback:', ptError);
                    }
                }
            }

            await fetchRecommendations();
            closeModal();
        } catch (err) {
            console.error('Submission failed', err);
            // Fallback mock
            const benchmarkTicker = selectedMarket === 'US' ? '^GSPC' : '^NSEI';
            const mockRec = {
                id: Math.random().toString(36).substr(2, 9),
                user_id: session.user.id,
                ticker,
                action: isWatchlistAdd ? 'WATCH' : action,
                entry_price: isWatchlistAdd ? null : (parseFloat(entryPrice) || 0),
                current_price: parseFloat(entryPrice) || 0,
                thesis,
                benchmark_ticker: benchmarkTicker,
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

    // Check for price alerts and create them if conditions are met
    const checkAndCreateAlerts = async (rec: any, currentPrice: number) => {
        if (!session?.user?.id) return;

        try {
            const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format

            // Check new price_alert_triggers table (multiple triggers per stock)
            if (rec.status === 'WATCHLIST') {
                const { data: triggers } = await supabase
                    .from('price_alert_triggers')
                    .select('*')
                    .eq('recommendation_id', rec.id)
                    .eq('is_active', true);

                if (triggers && triggers.length > 0) {
                    for (const trigger of triggers) {
                        let isTriggered = false;
                        if (trigger.alert_type === 'BUY' && currentPrice <= trigger.trigger_price) {
                            isTriggered = true;
                        } else if (trigger.alert_type === 'SELL' && currentPrice >= trigger.trigger_price) {
                            isTriggered = true;
                        }

                        if (isTriggered) {
                            // Check if alert already exists for today
                            const { data: existingAlert } = await supabase
                                .from('price_alerts')
                                .select('id')
                                .eq('recommendation_id', rec.id)
                                .eq('alert_type', trigger.alert_type)
                                .eq('trigger_price', trigger.trigger_price)
                                .gte('created_at', `${today}T00:00:00Z`)
                                .lt('created_at', `${today}T23:59:59Z`)
                                .maybeSingle();

                            if (!existingAlert) {
                                const currency = !rec.ticker.includes('.NS') && !rec.ticker.includes('.BO') ? '$' : '₹';
                                const { error: alertError } = await supabase
                                    .from('price_alerts')
                                    .insert([{
                                        user_id: session.user.id,
                                        recommendation_id: rec.id,
                                        ticker: rec.ticker,
                                        alert_type: trigger.alert_type,
                                        trigger_price: trigger.trigger_price,
                                        current_price: currentPrice,
                                        message: `${rec.ticker} ${trigger.alert_type === 'BUY' ? 'dropped to' : 'rose to'} ${currency}${currentPrice.toFixed(2)}, ${trigger.alert_type === 'BUY' ? 'below' : 'above'} your ${trigger.alert_type} price of ${currency}${trigger.trigger_price.toFixed(2)}`,
                                    }]);

                                if (!alertError) {
                                    const currency = !rec.ticker.includes('.NS') && !rec.ticker.includes('.BO') ? '$' : '₹';
                                    toast.success(`🔔 ${rec.ticker} hit ${trigger.alert_type} price (${currency}${trigger.trigger_price.toFixed(2)})!`, {
                                        duration: 5000,
                                        icon: trigger.alert_type === 'BUY' ? '📈' : '📉',
                                    });
                                }
                            }
                        }
                    }
                }
            }

            // Check legacy BUY price alert (current price <= buy_price)
            if (rec.buy_price && currentPrice <= rec.buy_price) {
                // Check if BUY alert already exists for today
                const { data: existingBuyAlerts } = await supabase
                    .from('price_alerts')
                    .select('id')
                    .eq('recommendation_id', rec.id)
                    .eq('alert_type', 'BUY')
                    .gte('created_at', `${today}T00:00:00Z`)
                    .lt('created_at', `${today}T23:59:59Z`);

                if (!existingBuyAlerts || existingBuyAlerts.length === 0) {
                    const currency = !rec.ticker.includes('.NS') && !rec.ticker.includes('.BO') ? '$' : '₹';
                    const { error: buyError } = await supabase
                        .from('price_alerts')
                        .insert([{
                            user_id: session.user.id,
                            recommendation_id: rec.id,
                            ticker: rec.ticker,
                            alert_type: 'BUY',
                            trigger_price: rec.buy_price,
                            current_price: currentPrice,
                            message: `${rec.ticker} dropped to ${currency}${currentPrice.toFixed(2)}, below your BUY price of ${currency}${rec.buy_price.toFixed(2)}`,
                        }]);

                    if (!buyError) {
                        toast.success(`🔔 ${rec.ticker} hit BUY price!`, {
                            duration: 5000,
                            icon: '📈',
                        });
                    }
                }
            }

            // Check legacy SELL price alert (current price >= sell_price)
            if (rec.sell_price && currentPrice >= rec.sell_price) {
                // Check if SELL alert already exists for today
                const { data: existingSellAlerts } = await supabase
                    .from('price_alerts')
                    .select('id')
                    .eq('recommendation_id', rec.id)
                    .eq('alert_type', 'SELL')
                    .gte('created_at', `${today}T00:00:00Z`)
                    .lt('created_at', `${today}T23:59:59Z`);

                if (!existingSellAlerts || existingSellAlerts.length === 0) {
                    const currency = !rec.ticker.includes('.NS') && !rec.ticker.includes('.BO') ? '$' : '₹';
                    const { error: sellError } = await supabase
                        .from('price_alerts')
                        .insert([{
                            user_id: session.user.id,
                            recommendation_id: rec.id,
                            ticker: rec.ticker,
                            alert_type: 'SELL',
                            trigger_price: rec.sell_price,
                            current_price: currentPrice,
                            message: `${rec.ticker} rose to ${currency}${currentPrice.toFixed(2)}, above your SELL price of ${currency}${rec.sell_price.toFixed(2)}`,
                        }]);

                    if (!sellError) {
                        toast.success(`🔔 ${rec.ticker} hit SELL price!`, {
                            duration: 5000,
                            icon: '📉',
                        });
                    }
                }
            }
        } catch (err) {
            console.error('Error checking alerts:', err);
        }
    };

    const closeModal = useCallback(() => {
        setShowModal(false);
        // Reset form state
        setTicker('');
        setSearchResults([]);
        setEntryPrice('');
        setThesis('');
        setCurrentPrice(null);
        setError(null);
        setSelectedImages([]);
        setBuyPrice('');
        setSellPrice('');
        setPriceTarget('');
        setTargetDate('');
        setSelectedMarket('IN'); // Reset to default Indian market
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
    }, []);

    // Filter recommendations by view mode - MUST be before early return
    const displayedRecommendations = useMemo(() => {
        return recommendations.filter(rec => {
            if (viewMode === 'active') return rec.status === 'OPEN';
            if (viewMode === 'watchlist') return rec.status === 'WATCHLIST';
            if (viewMode === 'history') return rec.status === 'CLOSED';
            return false;
        });
    }, [recommendations, viewMode]);

    // Portfolio returns state
    const [portfolioReturns, setPortfolioReturns] = useState<Array<{ week: string; return: number; cumulativeReturn: number; count: number }>>([]);

    // Fetch portfolio returns from API - only re-fetch when range changes
    useEffect(() => {
        const fetchPortfolioReturns = async () => {
            if (!session?.user?.id) {
                setPortfolioReturns([]);
                return;
            }

            // Always fetch portfolio returns, even if no recommendations
            // The API will return empty data if no OPEN recommendations exist

            setPortfolioReturnsLoading(true);
            try {
                // Map frontend period to API range
                const rangeMap: Record<'day' | 'week' | 'month', 'DAY' | 'WEEK' | 'MONTH'> = {
                    'day': 'DAY',
                    'week': 'WEEK',
                    'month': 'MONTH'
                };
                const range = rangeMap[portfolioReturnsPeriod];

                console.log('Fetching portfolio returns for user:', session.user.id, 'range:', range);
                const data = await getRollingPortfolioReturns(session.user.id, range);
                console.log('Portfolio returns API response:', data);

                // Handle error response
                if (data && data.error) {
                    console.error('API returned error:', data.error);
                    setPortfolioReturns([]);
                    return;
                }

                if (data && data.points && Array.isArray(data.points) && data.points.length > 0) {
                    // Transform API response to chart format
                    const transformed = data.points.map((point: any, index: number) => {
                        try {
                            const date = new Date(point.date);
                            let label = '';

                            if (portfolioReturnsPeriod === 'day') {
                                label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                            } else if (portfolioReturnsPeriod === 'week') {
                                // For weekly, show week start date (Monday)
                                label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                            } else {
                                // For monthly, show month and year
                                label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                            }

                            return {
                                week: label,
                                return: typeof point.value === 'number' ? point.value : 0, // Already in percentage
                                cumulativeReturn: (data.cumulative && data.cumulative[index] && typeof data.cumulative[index].value === 'number') ? data.cumulative[index].value : 0,
                                count: point.active_count || 0
                            };
                        } catch (e) {
                            console.error('Error transforming point:', point, e);
                            return null;
                        }
                    }).filter((item: any) => item !== null);

                    console.log('Transformed portfolio returns:', transformed);
                    if (transformed.length > 0) {
                        setPortfolioReturns(transformed);
                    } else {
                        console.warn('No valid transformed data');
                        setPortfolioReturns([]);
                    }
                } else {
                    console.warn('No portfolio returns data or empty points array:', data);
                    setPortfolioReturns([]);
                }
            } catch (error) {
                console.error('Error fetching portfolio returns:', error);
                setPortfolioReturns([]);
            } finally {
                setPortfolioReturnsLoading(false);
            }
        };

        fetchPortfolioReturns();
        // Only re-fetch when range changes, not when recommendations change
    }, [session?.user?.id, portfolioReturnsPeriod]);

    // Calculate total portfolio return
    const totalPortfolioReturn = useMemo(() => {
        if (!recommendations || recommendations.length === 0) return 0;

        const activeRecs = recommendations.filter(r => r.status === 'OPEN' || r.status === 'CLOSED');
        if (activeRecs.length === 0) return 0;

        let totalReturn = 0;
        activeRecs.forEach(rec => {
            const entry = rec.entry_price || 0;
            const current = rec.status === 'CLOSED' ? (rec.exit_price || entry) : (rec.current_price || entry);

            if (entry > 0) {
                if (rec.status === 'CLOSED' && rec.final_return_pct !== undefined) {
                    totalReturn += rec.final_return_pct;
                } else {
                    totalReturn += getReturnFromCacheOrCalculate(
                        rec.ticker,
                        entry,
                        current || null,
                        rec.action || 'BUY'
                    );
                }
            }
        });

        return activeRecs.length > 0 ? totalReturn / activeRecs.length : 0; // Average return
    }, [recommendations]);

    // Calculate portfolio allocation - count of BUY/SELL recommendations (only active/OPEN)
    const portfolioAllocation = useMemo(() => {
        if (!recommendations || recommendations.length === 0) return [];

        const allocationMap: Record<string, { buyCount: number; sellCount: number }> = {};

        // Only count OPEN recommendations
        recommendations
            .filter(rec => rec.status === 'OPEN')
            .forEach(rec => {
                if (!allocationMap[rec.ticker]) {
                    allocationMap[rec.ticker] = { buyCount: 0, sellCount: 0 };
                }

                if (rec.action === 'BUY') {
                    allocationMap[rec.ticker].buyCount += 1;
                } else if (rec.action === 'SELL') {
                    allocationMap[rec.ticker].sellCount += 1;
                }
            });

        return Object.entries(allocationMap)
            .filter(([_, data]) => data.buyCount > 0 || data.sellCount > 0)
            .map(([ticker, data]) => ({
                ticker,
                buyCount: data.buyCount,
                sellCount: data.sellCount
            }));
    }, [recommendations]);

    // Calculate monthly P&L - equal weight portfolio return %
    const monthlyPnL = useMemo(() => {
        if (!recommendations || recommendations.length === 0) return [];

        const now = new Date();
        const months: Record<string, number[]> = {};

        // Get last 6 months
        for (let i = 5; i >= 0; i--) {
            const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
            const monthKey = monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

            months[monthKey] = [];

            recommendations.forEach(rec => {
                if (rec.status === 'WATCHLIST') return;

                const entryDate = new Date(rec.entry_date);
                const exitDate = rec.exit_date ? new Date(rec.exit_date) : now;

                // Check if recommendation overlaps with this month
                if (entryDate <= monthEnd && exitDate >= monthStart) {
                    const entry = rec.entry_price || 0;
                    const current = rec.status === 'CLOSED' ? (rec.exit_price || entry) : (rec.current_price || entry);

                    if (entry > 0) {
                        let ret = 0;
                        if (rec.status === 'CLOSED' && rec.final_return_pct !== undefined) {
                            ret = rec.final_return_pct;
                        } else {
                            ret = getReturnFromCacheOrCalculate(
                                rec.ticker,
                                entry,
                                current || null,
                                rec.action || 'BUY'
                            );
                        }
                        months[monthKey].push(ret);
                    }
                }
            });
        }

        // Calculate equal-weight portfolio return (average of all returns)
        return Object.entries(months).map(([month, returns]) => {
            const avgReturn = returns.length > 0
                ? returns.reduce((sum, r) => sum + r, 0) / returns.length
                : 0;
            return {
                month,
                return: avgReturn
            };
        });
    }, [recommendations]);

    // Calculate ideas added over time (day/week/month)
    const ideasAddedData = useMemo(() => {
        if (!recommendations || recommendations.length === 0) return [];

        const now = new Date();
        const periods: Array<{ period: string; openRecommendations: number; watchlist: number; closed: number }> = [];
        const count = ideasAddedPeriod === 'day' ? 30 : ideasAddedPeriod === 'week' ? 8 : 6;

        for (let i = count - 1; i >= 0; i--) {
            let periodStart: Date;
            let periodEnd: Date;
            let periodLabel: string;

            if (ideasAddedPeriod === 'day') {
                periodStart = new Date(now);
                periodStart.setDate(now.getDate() - i);
                periodStart.setHours(0, 0, 0, 0);
                periodEnd = new Date(periodStart);
                periodEnd.setHours(23, 59, 59, 999);
                periodLabel = periodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            } else if (ideasAddedPeriod === 'week') {
                periodStart = new Date(now);
                periodStart.setDate(now.getDate() - (now.getDay() + i * 7));
                periodStart.setHours(0, 0, 0, 0);
                periodEnd = new Date(periodStart);
                periodEnd.setDate(periodStart.getDate() + 6);
                periodEnd.setHours(23, 59, 59, 999);
                periodLabel = periodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            } else {
                // month
                periodStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
                periodEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
                periodLabel = periodStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            }

            // Count recommendations added in this period
            const addedInPeriod = recommendations.filter(rec => {
                if (!rec.entry_date) return false;
                const entryDate = new Date(rec.entry_date);
                return entryDate >= periodStart && entryDate <= periodEnd;
            });

            // Count only OPEN recommendations added in this period
            const openRecommendationsCount = addedInPeriod.filter(r => r.status === 'OPEN').length;
            const watchlistCount = addedInPeriod.filter(r => r.status === 'WATCHLIST').length;

            // Count stocks closed in this period (when exit_date falls within period)
            const closedInPeriod = recommendations.filter(rec => {
                if (!rec.exit_date || rec.status !== 'CLOSED') return false;
                const exitDate = new Date(rec.exit_date);
                return exitDate >= periodStart && exitDate <= periodEnd;
            });
            const closedCount = closedInPeriod.length;

            periods.push({
                period: periodLabel,
                openRecommendations: openRecommendationsCount,
                watchlist: watchlistCount,
                closed: closedCount
            });
        }

        return periods;
    }, [recommendations, ideasAddedPeriod]);

    // Calculate top performers by period (day/week/month) - only active positions
    // Returns separate arrays for winners and losers
    const { topWinners, topLosers } = useMemo(() => {
        if (!recommendations || recommendations.length === 0) {
            return { topWinners: [], topLosers: [] };
        }

        // Only get OPEN recommendations
        const activeRecs = recommendations.filter(rec => rec.status === 'OPEN' && rec.entry_date);

        if (activeRecs.length === 0) {
            return { topWinners: [], topLosers: [] };
        }

        const now = new Date();
        let periodStart: Date;

        if (topPerformersPeriod === 'day') {
            // Today - period start is beginning of today
            periodStart = new Date(now);
            periodStart.setHours(0, 0, 0, 0);
        } else if (topPerformersPeriod === 'week') {
            // Last 7 days
            periodStart = new Date(now);
            periodStart.setDate(now.getDate() - 7);
            periodStart.setHours(0, 0, 0, 0);
        } else {
            // Last 30 days
            periodStart = new Date(now);
            periodStart.setDate(now.getDate() - 30);
            periodStart.setHours(0, 0, 0, 0);
        }

        // Calculate period-specific returns for each active position
        // Only include stocks that were active during the period
        const periodReturns = activeRecs
            .filter(rec => {
                const entryDate = new Date(rec.entry_date);
                return entryDate <= now; // Stock must have been added before or during period
            })
            .map(rec => {
                // Determine start price for period calculation
                // If stock was added before period start, ideally we'd use price at period start
                // For now, we'll use entry_price as proxy (entry_price is closest to period start)
                // If stock was added during period, use entry_price
                const startPrice = rec.entry_price || 0;

                // End price is current price
                const endPrice = rec.current_price || startPrice;

                let periodReturn = 0;

                if (startPrice > 0 && endPrice > 0) {
                    // Calculate absolute return for the period: (end - start) / start * 100
                    periodReturn = ((endPrice - startPrice) / startPrice) * 100;

                    // Apply action (BUY/SELL) - SELL positions have inverted returns
                    if (rec.action === 'SELL') {
                        periodReturn = -periodReturn;
                    }
                }

                return {
                    ticker: rec.ticker,
                    return: periodReturn,
                    status: rec.status
                };
            });

        // Split into winners (positive) and losers (negative)
        const winners = periodReturns
            .filter(r => r.return > 0)
            .sort((a, b) => b.return - a.return)
            .slice(0, 5);

        const losers = periodReturns
            .filter(r => r.return < 0)
            .sort((a, b) => a.return - b.return) // Sort ascending (most negative first)
            .slice(0, 5);

        return { topWinners: winners, topLosers: losers };
    }, [recommendations, topPerformersPeriod]);

    // Keep backward compatibility for now
    const topPerformersByPeriod = useMemo(() => {
        return [...topWinners, ...topLosers].sort((a, b) => b.return - a.return);
    }, [topWinners, topLosers]);

    // Calculate KPI data for mini charts
    const kpiData = useMemo(() => {
        const activeCount = recommendations.filter(r => r.status === 'OPEN').length;
        const totalValue = recommendations
            .filter(r => r.status === 'OPEN')
            .reduce((sum, r) => sum + ((r.entry_price || 0) * 1), 0);

        // Generate trend data (last 7 days)
        const trendData = [];
        const now = new Date();
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            // Count active recommendations on this date
            const countOnDate = recommendations.filter(r => {
                if (r.status !== 'OPEN') return false;
                const entryDate = new Date(r.entry_date);
                return entryDate <= date;
            }).length;

            trendData.push({ date: dateKey, value: countOnDate });
        }

        return {
            activeCount,
            totalValue,
            trendData
        };
    }, [recommendations]);

    // Early return after all hooks
    if (!session) {
        return (
            <div className="h-screen flex items-center justify-center bg-slate-900">
                <p className="text-white">Please log in</p>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-4rem)] bg-[var(--bg-primary)] md:overflow-hidden overflow-y-auto md:overflow-y-hidden">
            <Toaster
                position="top-right"
                toastOptions={{
                    duration: 5000,
                    style: {
                        background: '#1e293b',
                        color: '#fff',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                    },
                    success: {
                        iconTheme: {
                            primary: '#10b981',
                            secondary: '#fff',
                        },
                    },
                }}
            />

            {/* Mobile: Dashboard with Portfolio Summary and Recommendations List */}
            <div className="md:hidden min-h-screen pb-20" style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom))' }}>
                {/* Dashboard Header - Mobile optimized */}
                <div className="sticky top-0 z-30 bg-[var(--bg-primary)]/95 backdrop-blur-xl border-b border-[var(--border-color)] px-4 py-3">
                    <div className="flex items-center justify-between">
                        <h1 className="text-xl font-bold text-[var(--text-primary)]">Dashboard</h1>
                        <div className="flex items-center gap-3">
                            <button className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                                <Moon className="w-5 h-5" />
                            </button>
                            <div className="w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center overflow-hidden">
                                {clerkUser?.imageUrl ? (
                                    <img src={clerkUser.imageUrl} alt={clerkUser.firstName || 'User'} className="w-full h-full object-cover" />
                                ) : (
                                    <User className="w-5 h-5 text-indigo-400" />
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Portfolio Summary Section - Mobile optimized */}
                <div className="px-4 py-3">
                    <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)] p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-base font-bold text-[var(--text-primary)]">Portfolio Returns</h2>
                            <select
                                value={portfolioReturnsPeriod}
                                onChange={(e) => setPortfolioReturnsPeriod(e.target.value as 'day' | 'week' | 'month')}
                                className="text-sm text-[var(--text-secondary)] bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
                            >
                                <option value="day">Daily</option>
                                <option value="week">Weekly</option>
                                <option value="month">Monthly</option>
                            </select>
                        </div>

                        {/* Total Return Display - Mobile optimized */}
                        <div className="mb-3">
                            <div className="text-2xl font-bold font-mono text-[var(--text-primary)] mb-1">
                                {totalPortfolioReturn >= 0 ? '+' : ''}{totalPortfolioReturn.toFixed(2)}%
                            </div>
                            <p className="text-xs text-[var(--text-secondary)]">Average Portfolio Return</p>
                        </div>

                        {/* Weekly Returns Chart */}
                        <div className="h-[200px] -mx-2">
                            {portfolioReturnsLoading ? (
                                <div className="flex items-center justify-center h-full text-[var(--text-secondary)] text-sm">
                                    Loading...
                                </div>
                            ) : portfolioReturns.length > 0 ? (
                                <WeeklyReturnsChart data={portfolioReturns} height={200} />
                            ) : (
                                <div className="flex items-center justify-center h-full text-[var(--text-secondary)] text-sm">
                                    No data available
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* KPI Mini Charts Section */}
                <div className="px-4 py-3 grid grid-cols-2 gap-3">
                    <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-3">
                        <KPIMiniChart
                            data={kpiData.trendData}
                            label="Active Positions"
                            value={kpiData.activeCount}
                            color="#6366f1"
                            trend={kpiData.activeCount > 0 ? 'up' : 'neutral'}
                        />
                    </div>
                    <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-3">
                        <KPIMiniChart
                            data={kpiData.trendData.map(d => ({ ...d, value: d.value * 1000 }))}
                            label="Portfolio Value"
                            value={`₹${(kpiData.totalValue / 1000).toFixed(0)}K`}
                            color="#10b981"
                            trend="up"
                        />
                    </div>
                </div>

                {/* Top Winners & Losers Section */}
                <div className="px-4 py-3 grid grid-cols-1 gap-3">
                    {topWinners.length > 0 && (
                        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-bold text-[var(--text-primary)]">Top Winners</h3>
                                <select
                                    value={topPerformersPeriod}
                                    onChange={(e) => setTopPerformersPeriod(e.target.value as 'day' | 'week' | 'month')}
                                    className="text-xs text-[var(--text-secondary)] bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-2 py-1 focus:outline-none cursor-pointer"
                                >
                                    <option value="day">Today</option>
                                    <option value="week">This Week</option>
                                    <option value="month">This Month</option>
                                </select>
                            </div>
                            <div className="h-[180px] -mx-2">
                                <TopPerformersChart data={topWinners} height={180} />
                            </div>
                        </div>
                    )}

                    {topLosers.length > 0 && (
                        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-bold text-[var(--text-primary)]">Top Losers</h3>
                                <select
                                    value={topPerformersPeriod}
                                    onChange={(e) => setTopPerformersPeriod(e.target.value as 'day' | 'week' | 'month')}
                                    className="text-xs text-[var(--text-secondary)] bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-2 py-1 focus:outline-none cursor-pointer"
                                >
                                    <option value="day">Today</option>
                                    <option value="week">This Week</option>
                                    <option value="month">This Month</option>
                                </select>
                            </div>
                            <div className="h-[180px] -mx-2">
                                <TopPerformersChart data={topLosers} height={180} />
                            </div>
                        </div>
                    )}

                    {portfolioAllocation.length > 0 && (
                        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-4 overflow-visible">
                            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">Portfolio Allocation</h3>
                            <div className="h-[200px] -mx-2 overflow-visible">
                                <PortfolioAllocationDonut data={portfolioAllocation} height={200} />
                            </div>
                        </div>
                    )}
                </div>

                {/* Monthly P&L Section */}
                {monthlyPnL.length > 0 && (
                    <div className="px-4 py-3">
                        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-4">
                            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">Monthly P&L</h3>
                            <div className="h-[200px] -mx-2">
                                <MonthlyPnLChart data={monthlyPnL} height={200} />
                            </div>
                        </div>
                    </div>
                )}

                {/* Recommendations List Section - Mobile optimized */}
                <div className="px-4 pb-4">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-base font-bold text-[var(--text-primary)]">
                            {viewMode === 'active' ? 'Active Positions' : viewMode === 'watchlist' ? 'Watchlist' : 'Closed Positions'}
                        </h2>
                        <select
                            value={viewMode}
                            onChange={(e) => setViewMode(e.target.value as 'active' | 'watchlist' | 'history')}
                            className="text-sm text-[var(--text-secondary)] bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        >
                            <option value="active">Active</option>
                            <option value="watchlist">Watchlist</option>
                            <option value="history">History</option>
                        </select>
                    </div>

                    {/* Idea Cards List */}
                    {isLoadingPrices ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-32 bg-[var(--card-bg)] rounded-xl animate-pulse" />
                            ))}
                        </div>
                    ) : displayedRecommendations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--card-bg)] flex items-center justify-center">
                                <Search className="w-8 h-8 text-[var(--text-tertiary)]" />
                            </div>
                            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                                {viewMode === 'active' ? 'No active ideas' : viewMode === 'watchlist' ? 'Watchlist is empty' : 'No past ideas'}
                            </h3>
                            <p className="text-sm text-[var(--text-secondary)] max-w-xs mb-6">
                                {viewMode === 'active'
                                    ? 'Start tracking your investment thesis by adding a new idea.'
                                    : viewMode === 'watchlist'
                                        ? 'Add stocks you want to monitor before making a decision.'
                                        : 'Closed positions will appear here for performance tracking.'}
                            </p>
                            <button
                                onClick={() => { setIsWatchlistAdd(false); setShowModal(true); }}
                                className="px-6 py-3 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                            >
                                <Plus className="w-5 h-5" />
                                Add First Idea
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {displayedRecommendations.map((rec) => (
                                <IdeaCardMobile
                                    key={rec.id}
                                    recommendation={rec}
                                    companyName={companyNames[rec.ticker]}
                                    isSelected={selectedStock?.id === rec.id}
                                    viewMode={viewMode}
                                    onSelect={() => setSelectedStock(rec)}
                                    onClose={(e) => handleCloseIdea(rec, e)}
                                    onPromote={(action, e) => handlePromoteWatchlist(rec, action, e)}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Stock Detail Overlay - Full screen on mobile */}
                {selectedStock && (
                    <div className="fixed inset-0 z-50 md:hidden">
                        <StockDetailPanel
                            stock={selectedStock}
                            onClose={() => setSelectedStock(null)}
                            isExpanded={false}
                        />
                    </div>
                )}
            </div>

            {/* Desktop: Original layout */}
            <div className="hidden md:block h-[calc(100vh-4rem)] overflow-hidden">
                <div className="h-full grid grid-cols-12 min-h-0">
                    {/* Left Panel: Idea List */}
                    <div className={`
                        ${isExpanded ? 'hidden' : 'col-span-12 md:col-span-6 lg:col-span-5 xl:col-span-5'}
                        h-full overflow-hidden flex flex-col bg-[var(--bg-primary)]
                    `}>
                        <div className="flex-1 overflow-y-auto relative">
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

                    {/* Right Panel: Stock Detail */}
                    {shouldRenderDetail && selectedStock && (
                        <div className={`
                            ${isExpanded ? 'col-span-12' : 'col-span-12 md:col-span-6 lg:col-span-7 xl:col-span-7'}
                            h-full min-h-0 relative transition-all duration-300 flex flex-col overflow-hidden
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

                    {/* Empty State - Dashboard Charts */}
                    {!selectedStock && (
                        <div className="col-span-12 md:col-span-6 lg:col-span-7 xl:col-span-7 h-full overflow-y-auto bg-[var(--bg-primary)]/50">
                            <div className="p-6 space-y-6">
                                {/* Portfolio Returns - Always show, positioned first */}
                                <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-base font-bold text-[var(--text-primary)]">Portfolio Returns</h3>
                                        <select
                                            value={portfolioReturnsPeriod}
                                            onChange={(e) => setPortfolioReturnsPeriod(e.target.value as 'day' | 'week' | 'month')}
                                            className="text-xs text-[var(--text-secondary)] bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-2 py-1 focus:outline-none cursor-pointer"
                                        >
                                            <option value="day">Day</option>
                                            <option value="week">Week</option>
                                            <option value="month">Month</option>
                                        </select>
                                    </div>
                                    <div className="h-[250px] -mx-2">
                                        {portfolioReturnsLoading ? (
                                            <div className="flex items-center justify-center h-full text-[var(--text-secondary)] text-sm">
                                                Loading...
                                            </div>
                                        ) : portfolioReturns.length > 0 ? (
                                            <WeeklyReturnsChart data={portfolioReturns} height={250} />
                                        ) : (
                                            <div className="flex items-center justify-center h-full text-[var(--text-secondary)] text-sm">
                                                No data available
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Ideas Added Chart */}
                                {ideasAddedData.length > 0 && (
                                    <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-base font-bold text-[var(--text-primary)]">Ideas Added</h3>
                                            <select
                                                value={ideasAddedPeriod}
                                                onChange={(e) => setIdeasAddedPeriod(e.target.value as 'day' | 'week' | 'month')}
                                                className="text-xs text-[var(--text-secondary)] bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-2 py-1 focus:outline-none cursor-pointer"
                                            >
                                                <option value="day">Day</option>
                                                <option value="week">Week</option>
                                                <option value="month">Month</option>
                                            </select>
                                        </div>
                                        <div className="h-[250px] -mx-2">
                                            <IdeasAddedChart data={ideasAddedData} height={250} periodType={ideasAddedPeriod} />
                                        </div>
                                    </div>
                                )}

                                {/* Portfolio Allocation */}
                                {portfolioAllocation.length > 0 && (
                                    <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-4 overflow-visible">
                                        <h3 className="text-base font-bold text-[var(--text-primary)] mb-4">Portfolio Allocation</h3>
                                        <div className="h-[250px] -mx-2 overflow-visible">
                                            <PortfolioAllocationDonut data={portfolioAllocation} height={250} />
                                        </div>
                                    </div>
                                )}

                                {/* Top Performers */}
                                {topPerformersByPeriod.length > 0 && (
                                    <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-base font-bold text-[var(--text-primary)]">Top Performers in Active Positions</h3>
                                            <select
                                                value={topPerformersPeriod}
                                                onChange={(e) => setTopPerformersPeriod(e.target.value as 'day' | 'week' | 'month')}
                                                className="text-xs text-[var(--text-secondary)] bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-2 py-1 focus:outline-none cursor-pointer"
                                            >
                                                <option value="day">Today</option>
                                                <option value="week">This Week</option>
                                                <option value="month">This Month</option>
                                            </select>
                                        </div>
                                        <div className="h-[250px] -mx-2">
                                            <TopPerformersChart data={topPerformersByPeriod} height={250} />
                                        </div>
                                    </div>
                                )}

                                {/* Empty State if no data */}
                                {ideasAddedData.length === 0 && portfolioAllocation.length === 0 && topWinners.length === 0 && topLosers.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-16 text-center">
                                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--card-bg)] flex items-center justify-center">
                                            <Search className="w-8 h-8 text-[var(--text-tertiary)]" />
                                        </div>
                                        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Select an idea</h3>
                                        <p className="text-sm text-[var(--text-secondary)] max-w-xs">
                                            Choose a stock from the list to view detailed analysis and charts.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile Bottom Nav for View Mode Switching - Always visible on mobile */}
            <div className="md:hidden">
                <MobileBottomNav
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    counts={{
                        active: recommendations.filter(r => r.status === 'OPEN').length,
                        watchlist: recommendations.filter(r => r.status === 'WATCHLIST').length,
                        history: recommendations.filter(r => r.status === 'CLOSED').length,
                    }}
                />
            </div>

            {/* Floating Action Button (FAB) for New Idea - Mobile */}
            <div className="md:hidden fixed bottom-20 right-4 z-50" style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom))' }}>
                {!selectedStock && (
                    <button
                        onClick={() => { setIsWatchlistAdd(false); setShowModal(true); }}
                        className="w-14 h-14 rounded-full bg-indigo-500 text-white
                                 shadow-lg shadow-indigo-500/30 hover:bg-indigo-400 active:scale-95 transition-all
                                 flex items-center justify-center"
                        title="New Idea"
                    >
                        <Plus className="w-6 h-6" />
                    </button>
                )}
            </div>

            {/* Desktop FAB */}
            <div className="hidden md:block fixed bottom-6 right-6 z-50">
                <button
                    onClick={() => { setIsWatchlistAdd(false); setShowModal(true); }}
                    className="w-14 h-14 rounded-full bg-indigo-500 text-white
                             shadow-lg shadow-indigo-500/30 hover:bg-indigo-400 transition-colors
                             flex items-center justify-center"
                    title="New Idea"
                >
                    <Plus className="w-6 h-6" />
                </button>
            </div>

            {/* New Idea Modal */}
            {showModal && (
                <div className="fixed z-50 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={closeModal}></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                        <div className="inline-block align-bottom bg-[var(--card-bg)] rounded-2xl text-left overflow-visible shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-[var(--border-color)] relative">
                            <div className="px-6 py-6">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-bold text-[var(--text-primary)]">
                                        {isWatchlistAdd ? 'Add to Watchlist' : 'New Recommendation'}
                                    </h3>
                                    <button onClick={closeModal} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors p-1 hover:bg-white/10 rounded-full">
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
                                    <div className="relative z-10">
                                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Stock Ticker</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                                                <Search className={`h-4 w-4 ${hasSearched && searchResults.length === 0 ? 'text-red-400' : 'text-gray-400'} group-focus-within:text-indigo-400 transition-colors`} />
                                            </div>
                                            <input
                                                type="text"
                                                required
                                                value={ticker}
                                                onChange={(e) => handleSearch(e.target.value)}
                                                className={`block w-full pl-10 pr-3 py-2.5 border rounded-lg leading-5 bg-white/5 text-[var(--text-primary)] placeholder-gray-500 focus:outline-none focus:ring-2 transition-all relative z-10
                            ${hasSearched && searchResults.length === 0 && ticker.length > 1
                                                        ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500'
                                                        : 'border-white/10 focus:ring-indigo-500/50 focus:border-indigo-500'}`}
                                                placeholder="Search ticker (e.g. RELIANCE)"
                                                autoComplete="off"
                                            />
                                        </div>
                                        {hasSearched && searchResults.length === 0 && ticker.length > 1 && (
                                            <div className="absolute right-0 top-0 text-xs text-red-400 font-medium flex items-center mt-8 mr-2 pointer-events-none z-20">
                                                Ticker incorrect
                                            </div>
                                        )}
                                        {(searchResults.length > 0 || isSearching) && ticker.length > 1 && (
                                            <ul className="absolute z-[100] mt-1 w-full bg-[#1e293b] border border-[var(--border-color)] shadow-2xl max-h-60 rounded-lg py-1 text-base overflow-y-auto overflow-x-hidden focus:outline-none sm:text-sm animate-fadeIn scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent backdrop-blur-sm">
                                                {isSearching ? (
                                                    <li className="px-4 py-3 text-gray-400 text-sm text-center">Searching...</li>
                                                ) : (
                                                    searchResults.map((res) => {
                                                        // Use market from backend if available, otherwise infer from symbol
                                                        const market = res.market || (res.symbol.includes('.NS') ? 'NSE' : res.symbol.includes('.BO') ? 'BSE' : 'US');
                                                        return (
                                                            <li
                                                                key={res.symbol}
                                                                className="cursor-pointer select-none relative py-2.5 pl-3 pr-9 text-[var(--text-primary)] hover:bg-indigo-600 transition-colors border-b border-[var(--border-color)] last:border-0 group"
                                                                onClick={() => selectStock(res.symbol)}
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-medium text-blue-200 group-hover:text-white transition-colors truncate">{res.name}</span>
                                                                            <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 whitespace-nowrap">
                                                                                {market}
                                                                            </span>
                                                                        </div>
                                                                        <span className="text-xs text-gray-400 group-hover:text-white/70 transition-colors font-mono">{res.symbol}</span>
                                                                    </div>
                                                                </div>
                                                            </li>
                                                        );
                                                    })
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
                                                    className="block w-full px-3 py-2.5 border border-[var(--border-color)] bg-white/5 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 sm:text-sm rounded-lg appearance-none cursor-pointer hover:bg-white/10 transition-colors"
                                                >
                                                    <option value="BUY" className="bg-[#1e293b]">BUY</option>
                                                    <option value="SELL" className="bg-[#1e293b]">SELL</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-1.5">Entry Price</label>
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                        <span className="text-gray-400 sm:text-sm">{getCurrencySymbol()}</span>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        required={!isWatchlistAdd}
                                                        value={entryPrice}
                                                        onChange={(e) => setEntryPrice(e.target.value)}
                                                        className="block w-full pl-7 pr-3 py-2.5 border border-[var(--border-color)] rounded-lg bg-white/5 text-[var(--text-primary)] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 sm:text-sm transition-all"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-1.5">Price Target (Optional)</label>
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                        <span className="text-gray-400 sm:text-sm">{getCurrencySymbol()}</span>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={priceTarget}
                                                        onChange={(e) => setPriceTarget(e.target.value)}
                                                        className="block w-full pl-7 pr-3 py-2.5 border border-[var(--border-color)] rounded-lg bg-white/5 text-[var(--text-primary)] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 sm:text-sm transition-all"
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
                                                    className="block w-full px-3 py-2.5 border border-[var(--border-color)] rounded-lg bg-white/5 text-[var(--text-primary)] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 sm:text-sm transition-all"
                                                    min={new Date().toISOString().split('T')[0]}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {currentPrice && !isWatchlistAdd && (
                                        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-300 flex items-center justify-between animate-fadeIn">
                                            <span className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                                Current Market Price
                                            </span>
                                            <span className="font-mono font-bold">{getCurrencySymbol()}{currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                    )}

                                    {/* Buy Price & Sell Price (for watchlist) */}
                                    {isWatchlistAdd && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-1.5">BUY Price</label>
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                        <span className="text-gray-400 sm:text-sm">{getCurrencySymbol()}</span>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={buyPrice}
                                                        onChange={(e) => setBuyPrice(e.target.value)}
                                                        placeholder="Alert when price ≤ BUY"
                                                        className="block w-full pl-7 pr-3 py-2.5 border border-[var(--border-color)] rounded-lg bg-white/5 text-[var(--text-primary)] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 sm:text-sm transition-all"
                                                    />
                                                </div>
                                                <p className="mt-1 text-xs text-gray-500">Alert when price drops to this level</p>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-1.5">SELL Price</label>
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                        <span className="text-gray-400 sm:text-sm">{getCurrencySymbol()}</span>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={sellPrice}
                                                        onChange={(e) => setSellPrice(e.target.value)}
                                                        placeholder="Alert when price ≥ SELL"
                                                        className="block w-full pl-7 pr-3 py-2.5 border border-[var(--border-color)] rounded-lg bg-white/5 text-[var(--text-primary)] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 sm:text-sm transition-all"
                                                    />
                                                </div>
                                                <p className="mt-1 text-xs text-gray-500">Alert when price rises to this level</p>
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Thesis / Notes</label>
                                        <textarea
                                            value={thesis}
                                            onChange={(e) => setThesis(e.target.value)}
                                            rows={3}
                                            className="block w-full py-2.5 px-3 border border-[var(--border-color)] rounded-lg bg-white/5 text-[var(--text-primary)] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 sm:text-sm transition-all resize-none"
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
        </div>
    );
}

