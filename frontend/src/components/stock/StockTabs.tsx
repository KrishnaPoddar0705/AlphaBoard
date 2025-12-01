/**
 * StockTabs Component
 * 
 * Elegant tab navigation for stock detail sections featuring:
 * - Smooth animated indicator
 * - Glassmorphic styling
 * - Icon + label design
 * - Keyboard accessible
 * 
 * @component
 */

import React from 'react';
import { BarChart3, FileText, DollarSign, Brain, TrendingUp, Newspaper } from 'lucide-react';

export type TabId = 'chart' | 'summary' | 'financials' | 'ai' | 'news';

interface Tab {
    id: TabId;
    label: string;
    icon: React.ReactNode;
    badge?: string;
}

interface StockTabsProps {
    activeTab: TabId;
    onTabChange: (tab: TabId) => void;
    isSticky?: boolean;
}

const tabs: Tab[] = [
    { id: 'chart', label: 'Charts', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'summary', label: 'Summary', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'financials', label: 'Financials', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'ai', label: 'AI Insights', icon: <Brain className="w-4 h-4" />, badge: 'Beta' },
    { id: 'news', label: 'News', icon: <Newspaper className="w-4 h-4" /> },
];

export function StockTabs({ activeTab, onTabChange, isSticky = false }: StockTabsProps) {
    return (
        <div
            className={`
                sticky top-[88px] z-20 transition-all duration-300
                ${isSticky 
                    ? 'bg-slate-900/95 backdrop-blur-xl border-b border-white/10' 
                    : 'bg-slate-900/80 backdrop-blur-sm border-b border-white/5'
                }
            `}
        >
            <div className="px-6">
                <nav className="flex gap-1 -mb-px" role="tablist">
                    {tabs.map((tab) => {
                        const isActive = activeTab === tab.id;
                        
                        return (
                            <button
                                key={tab.id}
                                role="tab"
                                aria-selected={isActive}
                                onClick={() => onTabChange(tab.id)}
                                className={`
                                    relative group flex items-center gap-2 px-4 py-3.5
                                    text-sm font-medium transition-all duration-200
                                    focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900
                                    ${isActive 
                                        ? 'text-white' 
                                        : 'text-slate-400 hover:text-slate-200'
                                    }
                                `}
                            >
                                {/* Icon */}
                                <span className={`
                                    transition-colors duration-200
                                    ${isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-400'}
                                `}>
                                    {tab.icon}
                                </span>

                                {/* Label */}
                                <span>{tab.label}</span>

                                {/* Badge */}
                                {tab.badge && (
                                    <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase rounded 
                                                   bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                                        {tab.badge}
                                    </span>
                                )}

                                {/* Active Indicator */}
                                {isActive && (
                                    <span 
                                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                                        style={{
                                            animation: 'slideIn 0.2s ease-out',
                                        }}
                                    />
                                )}

                                {/* Hover Background */}
                                <span className={`
                                    absolute inset-0 rounded-lg transition-colors duration-200
                                    ${isActive 
                                        ? 'bg-white/5' 
                                        : 'group-hover:bg-white/5'
                                    }
                                `} />
                            </button>
                        );
                    })}
                </nav>
            </div>
        </div>
    );
}

/**
 * Chart Sub-Tabs for Technical/Fundamental toggle
 */
interface ChartSubTabsProps {
    activeCategory: 'technical' | 'fundamental';
    activeTechnicalType: 'line' | 'candlestick';
    onCategoryChange: (category: 'technical' | 'fundamental') => void;
    onTechnicalTypeChange: (type: 'line' | 'candlestick') => void;
}

export function ChartSubTabs({
    activeCategory,
    activeTechnicalType,
    onCategoryChange,
    onTechnicalTypeChange,
}: ChartSubTabsProps) {
    return (
        <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
            {/* Category Toggle */}
            <div className="flex items-center gap-2 p-1 bg-slate-800/50 rounded-xl border border-white/5">
                <button
                    onClick={() => onCategoryChange('technical')}
                    className={`
                        px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200
                        ${activeCategory === 'technical'
                            ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }
                    `}
                >
                    Technical
                </button>
                <button
                    onClick={() => onCategoryChange('fundamental')}
                    className={`
                        px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200
                        ${activeCategory === 'fundamental'
                            ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }
                    `}
                >
                    Fundamental
                </button>
            </div>

            {/* Chart Type Toggle (only for technical) */}
            {activeCategory === 'technical' && (
                <div className="flex items-center gap-2 p-1 bg-slate-800/50 rounded-xl border border-white/5">
                    <button
                        onClick={() => onTechnicalTypeChange('line')}
                        className={`
                            px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200
                            ${activeTechnicalType === 'line'
                                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }
                        `}
                    >
                        Line
                    </button>
                    <button
                        onClick={() => onTechnicalTypeChange('candlestick')}
                        className={`
                            px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200
                            ${activeTechnicalType === 'candlestick'
                                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }
                        `}
                    >
                        Candles
                    </button>
                </div>
            )}
        </div>
    );
}

export default StockTabs;

