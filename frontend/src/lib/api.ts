import axios from 'axios';

// Use environment variable if set, otherwise determine based on mode
const API_URL = import.meta.env.VITE_API_URL ||
    (import.meta.env.PROD
        ? 'https://alphaboard-backend.onrender.com'
        : 'http://127.0.0.1:8000');

export const api = axios.create({
    baseURL: API_URL,
});

export const searchStocks = async (query: string) => {
    const res = await api.get(`/market/search?q=${query}`);
    return res.data;
};

export const getPrice = async (ticker: string) => {
    try {
        const res = await api.get(`/market/price/${ticker}`);
        return res.data;
    } catch (error: any) {
        // Handle 404 or other errors gracefully
        if (error.response?.status === 404 || error.response?.status === 500) {
            // Return a response indicating price is unavailable
            return { ticker, price: null, available: false };
        }
        // Re-throw unexpected errors
        throw error;
    }
};

// Deprecated: Monolithic fetch (avoid using)
export const getStockDetails = async (ticker: string) => {
    const res = await api.get(`/market/details/${ticker}`);
    return res.data;
};

// --- New Split Endpoints ---

export const getStockSummary = async (ticker: string) => {
    const res = await api.get(`/market/summary/${ticker}`);
    return res.data;
};

export const getStockHistory = async (ticker: string, period: string = "1y", interval: string = "1d") => {
    const res = await api.get(`/market/history/${ticker}`, {
        params: { period, interval }
    });
    return res.data;
};

export const getIncomeStatement = async (ticker: string) => {
    const res = await api.get(`/market/financials/income/${ticker}`);
    return res.data;
};

export const getBalanceSheet = async (ticker: string) => {
    const res = await api.get(`/market/financials/balance/${ticker}`);
    return res.data;
};

export const getCashFlow = async (ticker: string) => {
    const res = await api.get(`/market/financials/cashflow/${ticker}`);
    return res.data;
};

export const explainFinancials = async (ticker: string, incomeData: any[]) => {
    const res = await api.post(`/market/financials/explain/${ticker}`, {
        income: incomeData
    });
    return res.data;
};

export const getQuarterly = async (ticker: string) => {
    const res = await api.get(`/market/financials/quarterly/${ticker}`);
    return res.data;
};

export const getDividends = async (ticker: string) => {
    const res = await api.get(`/market/dividends/${ticker}`);
    return res.data;
};

export const getEarnings = async (ticker: string) => {
    const res = await api.get(`/market/earnings/${ticker}`);
    return res.data;
};

// Deprecated: Old thesis endpoint (kept for backward compatibility)
// export const generateThesis = async (ticker: string) => {
//     const res = await api.get(`/market/thesis/${ticker}`);
//     return res.data;
// };

// ---

export const createRecommendation = async (data: any, userId: string) => {
    if (!userId) {
        throw new Error('User ID is required. Please ensure user is authenticated and synced with Supabase.');
    }

    // Send user_id in request body instead of query parameter for security
    const res = await api.post(`/recommendations/create`, { ...data, user_id: userId });
    return res.data;
};

export const createWatchlistItem = async (data: any, userId: string) => {
    if (!userId) {
        throw new Error('User ID is required. Please ensure user is authenticated and synced with Supabase.');
    }

    // Use dedicated watchlist endpoint
    const res = await api.post(`/watchlist/create`, { ...data, user_id: userId });
    return res.data;
};

export const deleteWatchlistItem = async (recommendationId: string, userId: string) => {
    if (!userId) {
        throw new Error('User ID is required. Please ensure user is authenticated and synced with Supabase.');
    }

    // Use backend endpoint to bypass RLS (DELETE requests use query params)
    const res = await api.delete(`/watchlist/${recommendationId}`, {
        params: { user_id: userId }
    });
    return res.data;
};

export const getLeaderboard = async () => {
    const res = await api.get('/leaderboard');
    return res.data;
};

// --- News Endpoints ---

export const getStockNews = async (ticker: string, forceRefresh: boolean = false) => {
    const res = await api.get(`/news/${ticker}`, {
        params: { force_refresh: forceRefresh }
    });
    return res.data;
};

export const getELI5Summary = async (headline: string, content: string) => {
    const res = await api.post('/news/eli5', {
        headline,
        content
    });
    return res.data;
};

export const refreshNews = async (ticker: string) => {
    const res = await api.post(`/news/refresh/${ticker}`);
    return res.data;
};

// --- Thesis Endpoints ---

export const generateThesis = async (ticker: string, analystNotes?: string) => {
    const res = await api.post('/api/ai/generateThesis', {
        ticker,
        analyst_notes: analystNotes,
    });
    return res.data;
};

export const exportToPDF = async (thesis: any) => {
    const res = await api.post('/api/export/pdf', {
        thesis,
    });
    return res.data;
};

export const exportToNotion = async (thesis: any, title?: string) => {
    const res = await api.post('/api/export/notion', {
        thesis,
        notion_page_title: title,
    });
    return res.data;
};

// --- Podcast Endpoints ---

export const generatePodcast = async (request: {
    type: 'single-stock' | 'portfolio';
    ticker?: string;
    companyName?: string;
    news?: any[];
    weekStart?: string;
    weekEnd?: string;
    portfolioNews?: Record<string, any[]>;
    user_id?: string;
}) => {
    const res = await api.post('/api/podcast/generate', request);
    return res.data;
};

export const getPodcasts = async (userId: string, podcastType?: string, ticker?: string) => {
    const params: any = { user_id: userId };
    if (podcastType) params.podcast_type = podcastType;
    if (ticker) params.ticker = ticker;
    const res = await api.get('/api/podcasts', { params });
    return res.data;
};

export const getPodcast = async (podcastId: string, userId: string) => {
    const res = await api.get(`/api/podcasts/${podcastId}`, {
        params: { user_id: userId }
    });
    return res.data;
};

export const deletePodcast = async (podcastId: string, userId: string) => {
    const res = await api.delete(`/api/podcasts/${podcastId}`, {
        params: { user_id: userId }
    });
    return res.data;
};

export const savePodcast = async (podcastData: {
    user_id: string;
    podcast_type: 'single-stock' | 'portfolio';
    podcast_title: string;
    script: string;
    audio_base64?: string;
    duration?: string;
    ticker?: string;
    company_name?: string;
    key_points?: string[];
    highlights?: Array<{ ticker: string; summary: string }>;
    week_start?: string;
    week_end?: string;
}) => {
    const res = await api.post('/api/podcasts/save', podcastData);
    return res.data;
};

// --- Performance Endpoints ---

export const getAnalystPerformance = async (userId: string) => {
    const res = await api.get(`/api/analyst/${userId}/performance`);
    return res.data;
};

export const getLeaderboardPerformance = async () => {
    const res = await api.get('/api/leaderboard/performance');
    return res.data;
};

export const recomputePerformance = async (userId: string) => {
    const res = await api.post('/api/performance/recompute', null, {
        params: { user_id: userId }
    });
    return res.data;
};

export const getMonthlyMatrix = async (userId: string) => {
    const res = await api.get(`/api/performance/monthly-matrix/${userId}`);
    return res.data;
};

export const getPortfolioAllocation = async (userId: string) => {
    const res = await api.get(`/api/performance/portfolio-allocation/${userId}`);
    return res.data;
};

// --- Portfolio Balance Endpoints ---

export const getPortfolioBalance = async (userId: string) => {
    const res = await api.get(`/api/portfolio/balance/${userId}`);
    return res.data;
};

export const updatePortfolioWeights = async (userId: string, weightUpdates: Record<string, number>) => {
    const res = await api.put(`/api/portfolio/weights/${userId}`, weightUpdates);
    return res.data;
};

export const rebalancePortfolio = async (userId: string) => {
    const res = await api.post(`/api/portfolio/rebalance/${userId}`);
    return res.data;
};

export const rebalanceWeights = async (weightUpdate: { user_id: string; target_recommendation_id: string; new_weight: number }) => {
    const res = await api.post('/api/portfolio/rebalance-weights', weightUpdate);
    return res.data;
};

export const getPortfolioPreview = async (userId: string) => {
    const res = await api.get(`/api/portfolio/preview/${userId}`);
    return res.data;
};

export const getPortfolioContribution = async (userId: string) => {
    const res = await api.get(`/api/portfolio/contribution/${userId}`);
    return res.data;
};

// --- Price Target Endpoints ---

export const createPriceTarget = async (ticker: string, targetPrice: number, targetDate: string | null, userId: string) => {
    // Backend expects user_id as query parameter
    const res = await api.post(`/price-targets?user_id=${encodeURIComponent(userId)}`, {
        ticker,
        target_price: targetPrice,
        target_date: targetDate || null,
    });
    return res.data;
};

export const getPriceTargets = async (ticker: string, userId: string) => {
    const res = await api.get(`/price-targets/${ticker}`, {
        params: { user_id: userId }
    });
    return res.data;
};

export const getRollingPortfolioReturns = async (userId: string, range: 'DAY' | 'WEEK' | 'MONTH' = 'DAY') => {
    try {
        const res = await api.get(`/api/portfolio/rolling-returns`, {
            params: { user_id: userId, range }
        });
        return res.data;
    } catch (error: any) {
        // Handle CORS errors, network errors, and API errors gracefully
        console.error('Error fetching rolling portfolio returns:', error);
        
        // Return empty result structure to prevent UI crashes
        // The backend now returns 200 with error in body, but handle network errors here
        if (error.response?.data) {
            // Backend returned an error response (with CORS headers)
            return error.response.data;
        }
        
        // Network error or CORS error - return empty structure
        return {
            points: [],
            cumulative: [],
            meta: {
                window_days: range === 'DAY' ? 1 : (range === 'WEEK' ? 7 : 30),
                start_date: null,
                end_date: new Date().toISOString(),
                method_used: 'equal_weight',
                missing_symbols: []
            },
            error: 'Failed to fetch portfolio returns. Please try again later.'
        };
    }
};

export const getAnalystPriceTargets = async (analystUserId: string, ticker: string) => {
    const res = await api.get(`/price-targets/analyst/${analystUserId}/${ticker}`);
    return res.data;
};
