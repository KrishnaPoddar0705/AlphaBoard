import { useState, useEffect } from 'react';
import { X, User, Clock, Award } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getPrice } from '../../lib/api';
import { PerformanceMetricsV2 } from '../PerformanceMetricsV2';

interface AnalystProfileProps {
    analyst: any;
    onClose: () => void;
}

export default function AnalystProfile({ analyst, onClose }: AnalystProfileProps) {
    const [recommendations, setRecommendations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'portfolio' | 'history' | 'metrics'>('portfolio');

    useEffect(() => {
        if (analyst) {
            fetchAnalystData();
        }
    }, [analyst]);

    const fetchAnalystData = async () => {
        try {
            setLoading(true);
            const { data: recs } = await supabase
                .from('recommendations')
                .select('*')
                .eq('user_id', analyst.user_id)
                .order('entry_date', { ascending: false });

            if (recs) {
                // Fetch live prices for open positions
                const openRecs = recs.filter(r => r.status === 'OPEN');
                for (let r of openRecs) {
                    try {
                        const priceData = await getPrice(r.ticker);
                        r.current_price = priceData.price;
                    } catch (e) {
                        // keep DB price
                    }
                }
                setRecommendations(recs);
            }
        } catch (err) {
            console.error("Failed to fetch analyst data", err);
        } finally {
            setLoading(false);
        }
    };

    // Derived metrics
    const openPositions = recommendations.filter(r => r.status === 'OPEN');
    const closedPositions = recommendations.filter(r => r.status === 'CLOSED');
    
    // Calculate simple stats
    const totalTrades = recommendations.length;
    const wins = recommendations.filter(r => {
        const exit = r.status === 'CLOSED' ? r.exit_price : r.current_price;
        const ret = ((exit - r.entry_price) / r.entry_price) * (r.action === 'SELL' ? -1 : 1);
        return ret > 0;
    }).length;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            
            <div className="relative w-full max-w-2xl bg-[#0f172a] border-l border-white/10 shadow-2xl h-full overflow-hidden flex flex-col animate-slideInRight">
                {/* Header */}
                <div className="p-6 bg-[#1e293b] border-b border-white/10 flex justify-between items-start">
                    <div className="flex items-center gap-4">
                        <img src={analyst.avatar} alt={analyst.username} className="w-16 h-16 rounded-full bg-white/10 border-2 border-indigo-500/50" />
                        <div>
                            <h2 className="text-2xl font-bold text-white">{analyst.username}</h2>
                            <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                                <span className="flex items-center gap-1"><Award className="w-4 h-4 text-yellow-500" /> Rank #{analyst.rank || '-'}</span>
                                <span className="flex items-center gap-1"><User className="w-4 h-4 text-indigo-400" /> Analyst</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Stats Overview */}
                <div className="grid grid-cols-3 gap-4 p-6 border-b border-white/10 bg-[#1e293b]/50">
                    <div className="bg-white/5 rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-400 uppercase mb-1">Total Return</div>
                        <div className={`text-xl font-bold ${analyst.total_return_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {analyst.total_return_pct?.toFixed(2)}%
                        </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-400 uppercase mb-1">Win Rate</div>
                        <div className="text-xl font-bold text-white">{winRate.toFixed(1)}%</div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-400 uppercase mb-1">Alpha</div>
                        <div className={`text-xl font-bold ${analyst.alpha_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {analyst.alpha_pct?.toFixed(2)}%
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/10 bg-[#1e293b]">
                    <button
                        onClick={() => setActiveTab('portfolio')}
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'portfolio' ? 'border-indigo-500 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}
                    >
                        Current Portfolio
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'history' ? 'border-indigo-500 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}
                    >
                        Trade History
                    </button>
                    <button
                        onClick={() => setActiveTab('metrics')}
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'metrics' ? 'border-indigo-500 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}
                    >
                        Performance Metrics
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10">
                    {loading ? (
                        <div className="text-center py-10 text-gray-500">Loading analyst data...</div>
                    ) : (
                        <>
                            {activeTab === 'portfolio' && (
                                <div className="space-y-4">
                                    <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Active Positions</h3>
                                    {openPositions.length === 0 ? (
                                        <div className="text-gray-500 italic text-sm">No active positions.</div>
                                    ) : (
                                        openPositions.map(rec => (
                                            <div key={rec.id} className="bg-white/5 rounded-lg p-4 border border-white/5 hover:border-white/10 transition-colors">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <span className="text-lg font-bold text-white mr-2">{rec.ticker}</span>
                                                        <span className={`text-xs px-2 py-0.5 rounded ${rec.action === 'BUY' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>{rec.action}</span>
                                                    </div>
                                                    <div className={`text-sm font-bold ${((rec.current_price - rec.entry_price) / rec.entry_price * (rec.action === 'SELL' ? -1 : 1)) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        {(((rec.current_price - rec.entry_price) / rec.entry_price) * 100 * (rec.action === 'SELL' ? -1 : 1)).toFixed(2)}%
                                                    </div>
                                                </div>
                                                <div className="flex justify-between text-sm text-gray-400 mb-3">
                                                    <span>Entry: ₹{rec.entry_price?.toFixed(2)}</span>
                                                    <span>Current: ₹{rec.current_price?.toFixed(2)}</span>
                                                </div>
                                                {rec.thesis && (
                                                    <div className="bg-black/20 rounded p-3 text-sm text-gray-300 italic">
                                                        "{rec.thesis}"
                                                        {rec.images && rec.images.length > 0 && (
                                                            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                                                                {rec.images.map((img: string, idx: number) => (
                                                                    <a 
                                                                        key={idx} 
                                                                        href={img} 
                                                                        target="_blank" 
                                                                        rel="noopener noreferrer" 
                                                                        className="flex-shrink-0 w-16 h-16 rounded border border-white/10 overflow-hidden hover:border-indigo-500 transition-colors"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    >
                                                                        <img src={img} alt="thesis" className="w-full h-full object-cover" />
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {activeTab === 'history' && (
                                <div className="space-y-4">
                                    <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Past Trades</h3>
                                    {closedPositions.length === 0 ? (
                                        <div className="text-gray-500 italic text-sm">No trade history available.</div>
                                    ) : (
                                        closedPositions.map(rec => (
                                            <div key={rec.id} className="bg-white/5 rounded-lg p-4 border border-white/5 opacity-75 hover:opacity-100 transition-opacity">
                                                <div className="flex justify-between items-center mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-white">{rec.ticker}</span>
                                                        <span className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(rec.exit_date).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className={`font-mono font-bold ${rec.final_return_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        {rec.final_return_pct > 0 ? '+' : ''}{rec.final_return_pct?.toFixed(2)}%
                                                    </div>
                                                </div>
                                                {rec.thesis && (
                                                    <p className="text-xs text-gray-500 line-clamp-1">"{rec.thesis}"</p>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {activeTab === 'metrics' && (
                                <PerformanceMetricsV2 userId={analyst.user_id} />
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

