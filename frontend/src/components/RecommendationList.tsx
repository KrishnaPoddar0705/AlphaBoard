import React from 'react';
import { TrendingUp, TrendingDown, CheckCircle, Trash2, Plus } from 'lucide-react';

interface RecommendationListProps {
    recommendations: any[];
    selectedStock: any;
    setSelectedStock: (rec: any) => void;
    viewMode: 'active' | 'watchlist' | 'history';
    setViewMode: (mode: 'active' | 'watchlist' | 'history') => void;
    handleCloseIdea: (rec: any, e: React.MouseEvent) => void;
    handlePromoteWatchlist: (rec: any, action: 'BUY' | 'SELL', e: React.MouseEvent) => void;
    handleDeleteWatchlist: (rec: any, e: React.MouseEvent) => void;
    onNewIdea: () => void;
}

export default function RecommendationList({
    recommendations,
    selectedStock,
    setSelectedStock,
    viewMode,
    setViewMode,
    handleCloseIdea,
    handlePromoteWatchlist,
    handleDeleteWatchlist,
    onNewIdea
}: RecommendationListProps) {

    const displayedRecommendations = recommendations.filter(rec => {
        if (viewMode === 'active') return rec.status === 'OPEN';
        if (viewMode === 'watchlist') return rec.status === 'WATCHLIST';
        if (viewMode === 'history') return rec.status === 'CLOSED';
        return false;
    });

    return (
        <div className="flex flex-col h-full">
            {/* Header - Responsive */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 sm:p-6 border-b border-white/10 flex-shrink-0">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
                    <h1 className="text-xl sm:text-2xl font-bold text-white bg-clip-text text-transparent bg-gradient-to-r from-blue-200 to-purple-200 whitespace-nowrap">
                        My Ideas
                    </h1>
                    <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
                        <button
                            onClick={() => setViewMode('active')}
                            className={`px-2 sm:px-3 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === 'active' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            Active
                        </button>
                        <button
                            onClick={() => setViewMode('watchlist')}
                            className={`px-2 sm:px-3 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === 'watchlist' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            Watchlist
                        </button>
                        <button
                            onClick={() => setViewMode('history')}
                            className={`px-2 sm:px-3 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === 'history' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            History
                        </button>
                    </div>
                </div>
                <button
                    onClick={onNewIdea}
                    className="inline-flex items-center px-3 py-1.5 border border-white/10 rounded-lg text-sm font-medium text-white bg-indigo-600/80 hover:bg-indigo-500/80 backdrop-blur-sm transition-all whitespace-nowrap w-full sm:w-auto justify-center"
                >
                    <Plus className="w-4 h-4 mr-1.5" />
                    New
                </button>
            </div>

            {/* List Content - Scroll on Parent */}
            <div className="flex-1 overflow-y-auto overflow-x-auto scrollbar-thin scrollbar-thumb-white/10 p-0">
                <table className="w-full divide-y divide-white/10 table-auto min-w-[600px] lg:table-fixed lg:min-w-full">
                    <thead className="bg-[#0f172a] sticky top-0 z-10">
                        <tr>
                            <th className="lg:w-[22%] px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-blue-200/70 uppercase tracking-wider">Asset</th>
                            <th className="lg:w-[13%] px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-blue-200/70 uppercase tracking-wider">Date</th>
                            <th className="lg:w-[15%] px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-blue-200/70 uppercase tracking-wider">Entry</th>
                            <th className="lg:w-[15%] px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-blue-200/70 uppercase tracking-wider">Price</th>
                            <th className="lg:w-[18%] px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-blue-200/70 uppercase tracking-wider">Return</th>
                            <th className="lg:w-[17%] px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-blue-200/70 uppercase tracking-wider"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 bg-transparent text-white">
                        {displayedRecommendations.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-10 text-center text-white/50">
                                    {viewMode === 'active' ? "No active recommendations." :
                                        viewMode === 'watchlist' ? "Watchlist is empty." : "No past ideas found."}
                                </td>
                            </tr>
                        ) : displayedRecommendations.map((rec) => {
                            const entry = rec.entry_price || 0;
                            const isClosed = rec.status === 'CLOSED';
                            const current = isClosed ? (rec.exit_price || entry) : rec.current_price;
                            const hasCurrentPrice = current !== undefined && current !== null;

                            let ret = 0;
                            if (isClosed && rec.final_return_pct !== undefined) {
                                ret = rec.final_return_pct;
                            } else if (hasCurrentPrice && entry > 0 && viewMode !== 'watchlist') {
                                ret = ((current - entry) / entry * 100) * (rec.action === 'SELL' ? -1 : 1);
                            }

                            const isSelected = selectedStock?.id === rec.id;
                            const dateAdded = new Date(rec.entry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

                            return (
                                <tr
                                    key={rec.id}
                                    onClick={() => setSelectedStock(rec)}
                                    className={`cursor-pointer transition-colors ${isSelected ? 'bg-white/10 border-l-4 border-indigo-500' : 'hover:bg-white/5 border-l-4 border-transparent'}`}
                                >
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-white">{rec.ticker}</span>
                                            <span className={`text-[10px] font-bold uppercase w-fit px-1.5 py-0.5 rounded mt-1 ${rec.action === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                {rec.action}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs text-white/60">
                                        {dateAdded}
                                    </td>
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-white/70">₹{entry.toFixed(2)}</td>
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-white/70">
                                        {hasCurrentPrice ? `₹${current.toFixed(2)}` : '-'}
                                    </td>
                                    <td className={`px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-sm font-medium ${ret >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {viewMode !== 'watchlist' ? (
                                            <div className="flex items-center justify-end gap-1">
                                                {ret >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                {Math.abs(ret).toFixed(2)}%
                                            </div>
                                        ) : '-'}
                                    </td>
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end gap-1 sm:gap-2">
                                            {viewMode === 'active' && (
                                                <button
                                                    onClick={(e) => handleCloseIdea(rec, e)}
                                                    className="text-gray-400 hover:text-red-400 transition-colors p-1 hover:bg-red-500/10 rounded"
                                                    title="Close"
                                                >
                                                    <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                                                </button>
                                            )}
                                            {viewMode === 'watchlist' && (
                                                <div className="flex gap-1">
                                                    <button onClick={(e) => handlePromoteWatchlist(rec, 'BUY', e)} className="text-green-400 hover:bg-green-500/10 p-1 rounded text-xs font-bold">B</button>
                                                    <button onClick={(e) => handlePromoteWatchlist(rec, 'SELL', e)} className="text-red-400 hover:bg-red-500/10 p-1 rounded text-xs font-bold">S</button>
                                                    <button onClick={(e) => handleDeleteWatchlist(rec, e)} className="text-gray-400 hover:text-red-400 p-1 rounded"><Trash2 className="w-3 h-3" /></button>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
