import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Award, TrendingUp, TrendingDown } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getPrice, getLeaderboardPerformance } from '../lib/api';
import AnalystProfile from '../components/AnalystProfile/AnalystProfile';

// Mock competitors to make the leaderboard look populated
const MOCK_COMPETITORS = [
    { user_id: 'mock1', username: 'Sarah Chen', total_ideas: 12, win_rate: 75, total_return_pct: 15.4, alpha_pct: 15.4, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah' },
    { user_id: 'mock2', username: 'Michael Ross', total_ideas: 8, win_rate: 62.5, total_return_pct: 12.8, alpha_pct: 12.8, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Michael' },
    { user_id: 'mock3', username: 'Jessica Wu', total_ideas: 15, win_rate: 66.7, total_return_pct: 11.2, alpha_pct: 11.2, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jessica' },
    { user_id: 'mock4', username: 'David Miller', total_ideas: 6, win_rate: 50, total_return_pct: -2.5, alpha_pct: 9.5, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David' },
    { user_id: 'mock5', username: 'Emily Davis', total_ideas: 10, win_rate: 60, total_return_pct: 8.7, alpha_pct: 8.7, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emily' },
];

export default function Leaderboard() {
    const { session } = useAuth();
    const [analysts, setAnalysts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAnalyst, setSelectedAnalyst] = useState<any>(null);

    useEffect(() => {
        calculateLeaderboard();
    }, [session]);

    useEffect(() => {
        // Also fetch performance-enhanced leaderboard
        fetchPerformanceLeaderboard();
    }, []);

    const fetchPerformanceLeaderboard = async () => {
        try {
            const perfData = await getLeaderboardPerformance();
            if (perfData && perfData.length > 0) {
                // Merge performance data with existing analysts
                setAnalysts(prev => {
                    const merged = prev.map(analyst => {
                        const perf = perfData.find((p: any) => p.user_id === analyst.user_id);
                        if (perf) {
                            return {
                                ...analyst,
                                sharpe_ratio: perf.sharpe_ratio,
                                max_drawdown_pct: perf.max_drawdown_pct,
                                profitable_weeks_pct: perf.profitable_weeks_pct,
                                avg_risk_score: perf.avg_risk_score
                            };
                        }
                        return analyst;
                    });
                    return merged.sort((a, b) => (b.alpha_pct || 0) - (a.alpha_pct || 0));
                });
            }
        } catch (error) {
            console.error('Error fetching performance leaderboard:', error);
        }
    };

    const calculateLeaderboard = async () => {
        try {
            let currentUserStats = {
                user_id: session?.user?.id || 'current',
                username: 'You',
                total_ideas: 0,
                win_rate: 0,
                total_return_pct: 0,
                alpha_pct: 0,
                avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=You'
            };

            if (session?.user) {
                const { data: recommendations } = await supabase
                    .from('recommendations')
                    .select('*')
                    .eq('user_id', session.user.id);

                if (recommendations && recommendations.length > 0) {
                    // Filter out WATCHLIST items - they should not count towards portfolio performance
                    const portfolioRecs = recommendations.filter(r => r.status !== 'WATCHLIST');

                    if (portfolioRecs.length > 0) {
                        // Fetch live prices for OPEN positions
                        const openPositions = portfolioRecs.filter(r => r.status === 'OPEN');
                        const prices: Record<string, number> = {};

                        // Batch fetch would be better, but simple loop for now
                        await Promise.all(openPositions.map(async (rec) => {
                            try {
                                const data = await getPrice(rec.ticker);
                                if (data && data.price) {
                                    prices[rec.ticker] = data.price;
                                }
                            } catch (e) {
                                console.warn("Failed to fetch price for leaderboard", rec.ticker);
                            }
                        }));

                        const totalIdeas = portfolioRecs.length;
                        const wins = portfolioRecs.filter(r => {
                            // Skip if entry_price is missing
                            if (!r.entry_price) return false;

                            let currentPrice = r.current_price; // Default to DB value
                            if (r.status === 'OPEN' && prices[r.ticker]) {
                                currentPrice = prices[r.ticker];
                            } else if (r.status === 'CLOSED') {
                                currentPrice = r.exit_price || r.current_price;
                            }

                            const ret = ((currentPrice - r.entry_price) / r.entry_price * 100) * (r.action === 'SELL' ? -1 : 1);
                            return ret > 0;
                        }).length;

                        const totalReturn = portfolioRecs.reduce((acc, r) => {
                            // Skip if entry_price is missing
                            if (!r.entry_price) return acc;

                            let currentPrice = r.current_price;
                            if (r.status === 'OPEN' && prices[r.ticker]) {
                                currentPrice = prices[r.ticker];
                            } else if (r.status === 'CLOSED') {
                                currentPrice = r.exit_price || r.current_price;
                            }

                            const ret = ((currentPrice - r.entry_price) / r.entry_price * 100) * (r.action === 'SELL' ? -1 : 1);
                            return acc + ret;
                        }, 0);

                        currentUserStats = {
                            ...currentUserStats,
                            total_ideas: totalIdeas,
                            win_rate: totalIdeas > 0 ? (wins / totalIdeas) * 100 : 0,
                            total_return_pct: totalReturn, // Sum of returns for simplicity
                            alpha_pct: totalReturn // Using total return as proxy for alpha for now
                        };
                    }
                }
            }

            // Combine and sort
            const allAnalysts = [...MOCK_COMPETITORS, currentUserStats].sort((a, b) => b.alpha_pct - a.alpha_pct);
            setAnalysts(allAnalysts);

        } catch (err) {
            console.error(err);
            setAnalysts(MOCK_COMPETITORS);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-white">Loading leaderboard...</div>;

    return (
        <div className="space-y-8 relative">
            {/* Background glow effects */}
            <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-500/20 rounded-full mix-blend-screen filter blur-3xl animate-blob pointer-events-none"></div>
            <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-blue-500/20 rounded-full mix-blend-screen filter blur-3xl animate-blob animation-delay-2000 pointer-events-none"></div>

            <div className="text-center py-4 relative z-10">
                <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-purple-200">
                    Analyst Leaderboard
                </h1>
                <p className="mt-2 text-blue-200/60 font-light">Top performers ranked by Alpha generation</p>
            </div>

            <div className="glass-panel rounded-3xl overflow-hidden max-w-6xl mx-auto relative z-10">
                <table className="min-w-full divide-y divide-white/10">
                    <thead className="bg-white/5">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-medium text-blue-200/70 uppercase tracking-wider">Rank</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-blue-200/70 uppercase tracking-wider">Analyst</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-blue-200/70 uppercase tracking-wider">Total Ideas</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-blue-200/70 uppercase tracking-wider">Win Rate</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-blue-200/70 uppercase tracking-wider">Total Return</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-blue-200/70 uppercase tracking-wider">Alpha</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-blue-200/70 uppercase tracking-wider">Sharpe</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 bg-transparent text-white">
                        {analysts.map((analyst, index) => (
                            <tr key={analyst.user_id}
                                onClick={() => setSelectedAnalyst({ ...analyst, rank: index + 1 })}
                                className={`
                hover:bg-white/5 transition-colors cursor-pointer
                ${analyst.username === 'You' ? 'bg-indigo-500/10 border-l-2 border-l-indigo-500' : ''}
              `}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className={`
                      w-8 h-8 flex items-center justify-center rounded-full font-bold mr-2
                      ${index === 0 ? 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/30' :
                                                index === 1 ? 'bg-slate-300/20 text-slate-200 border border-slate-300/30' :
                                                    index === 2 ? 'bg-orange-400/20 text-orange-300 border border-orange-400/30' :
                                                        'text-white/40'}
                    `}>
                                            {index + 1}
                                        </div>
                                        {index === 0 && <Award className="w-5 h-5 text-yellow-400 drop-shadow-lg" />}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-3">
                                        <img src={analyst.avatar} alt={analyst.username} className="w-8 h-8 rounded-full bg-white/10" />
                                        <div className="font-medium text-white">{analyst.username}</div>
                                        {analyst.username === 'You' && <span className="text-xs bg-indigo-500/30 px-2 py-0.5 rounded text-indigo-200">Me</span>}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-white/70">
                                    {analyst.total_ideas}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-white/70">
                                    {analyst.win_rate?.toFixed(1)}%
                                </td>
                                <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${analyst.total_return_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    <div className="flex items-center gap-1">
                                        {analyst.total_return_pct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                        {analyst.total_return_pct?.toFixed(2)}%
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-3 py-1 inline-flex text-sm font-bold rounded-full ${analyst.alpha_pct >= 0 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}`}>
                                        {analyst.alpha_pct?.toFixed(2)}%
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-white/70" title={`Sharpe Ratio: ${analyst.sharpe_ratio?.toFixed(2) || 'N/A'}`}>
                                        {analyst.sharpe_ratio?.toFixed(2) || '-'}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {selectedAnalyst && (
                <AnalystProfile
                    analyst={selectedAnalyst}
                    onClose={() => setSelectedAnalyst(null)}
                />
            )}
        </div>
    );
}
