/**
 * AIInsightsSection Component
 * 
 * Placeholder component for future AI-powered features including:
 * - AI-generated stock analysis
 * - Sentiment analysis from news/social media
 * - Risk assessment
 * - Price predictions
 * - Pattern recognition insights
 * 
 * @component
 * @todo Implement actual AI integration when backend is ready
 */

import React from 'react';
import { Brain, Sparkles, TrendingUp, Shield, AlertTriangle, Zap, Lock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';

interface AIInsightsSectionProps {
    stockTicker: string;
    isEnabled?: boolean;
}

export function AIInsightsSection({ stockTicker, isEnabled = false }: AIInsightsSectionProps) {
    if (!isEnabled) {
        return <AIComingSoon stockTicker={stockTicker} />;
    }

    // Future implementation will go here
    return (
        <div className="space-y-4">
            {/* AI Analysis Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AIInsightCard
                    title="Sentiment Analysis"
                    status="neutral"
                    summary="Market sentiment appears neutral based on recent news and social media activity."
                    confidence={72}
                    icon={<TrendingUp className="w-5 h-5" />}
                />
                <AIInsightCard
                    title="Risk Assessment"
                    status="low"
                    summary="Low volatility expected. Historical patterns suggest stable price movement."
                    confidence={85}
                    icon={<Shield className="w-5 h-5" />}
                />
            </div>

            {/* AI Chat/Query Interface Placeholder */}
            <Card variant="glass">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <CardTitle>Ask AI About {stockTicker}</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Ask anything about this stock..."
                            disabled
                            className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl
                                     text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500
                                     transition-colors pr-12"
                        />
                        <button
                            disabled
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg
                                     bg-indigo-500/20 text-indigo-400 opacity-50 cursor-not-allowed"
                        >
                            <Zap className="w-4 h-4" />
                        </button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

/**
 * Individual AI Insight Card
 */
interface AIInsightCardProps {
    title: string;
    status: 'positive' | 'negative' | 'neutral' | 'low' | 'medium' | 'high';
    summary: string;
    confidence: number;
    icon: React.ReactNode;
}

const statusColors = {
    positive: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    negative: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    neutral: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
    low: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    high: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
};

function AIInsightCard({ title, status, summary, confidence, icon }: AIInsightCardProps) {
    return (
        <Card variant="default" className="relative overflow-hidden">
            {/* Gradient Accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
            
            <div className="pt-2">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${statusColors[status]}`}>
                            {icon}
                        </div>
                        <div>
                            <h4 className="text-white font-semibold">{title}</h4>
                            <span className={`text-xs font-medium uppercase ${statusColors[status].split(' ')[0]}`}>
                                {status}
                            </span>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-xs text-slate-400">Confidence</span>
                        <p className="text-lg font-bold text-white">{confidence}%</p>
                    </div>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed">{summary}</p>
            </div>
        </Card>
    );
}

/**
 * Coming Soon State
 */
function AIComingSoon({ stockTicker }: { stockTicker: string }) {
    return (
        <Card variant="glass" className="relative overflow-hidden">
            {/* Animated Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent" />
            
            <div className="relative py-12 text-center">
                {/* Icon with Glow */}
                <div className="relative inline-flex mb-6">
                    <div className="absolute inset-0 bg-indigo-500/30 rounded-full blur-xl animate-pulse" />
                    <div className="relative p-4 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30">
                        <Brain className="w-10 h-10 text-indigo-400" />
                    </div>
                </div>

                <h3 className="text-2xl font-bold text-white mb-2">
                    AI Insights Coming Soon
                </h3>
                <p className="text-slate-400 max-w-md mx-auto mb-6">
                    Advanced AI-powered analysis for <span className="text-indigo-400 font-semibold">{stockTicker}</span> including 
                    sentiment analysis, risk assessment, and predictive insights.
                </p>

                {/* Feature Preview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto mt-8">
                    <FeaturePreview icon={<Sparkles className="w-5 h-5" />} label="Smart Analysis" />
                    <FeaturePreview icon={<TrendingUp className="w-5 h-5" />} label="Predictions" />
                    <FeaturePreview icon={<Shield className="w-5 h-5" />} label="Risk Scoring" />
                    <FeaturePreview icon={<AlertTriangle className="w-5 h-5" />} label="Alerts" />
                </div>

                {/* Beta Access Button */}
                <button
                    className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-xl
                             bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold
                             hover:from-indigo-400 hover:to-purple-400 transition-all duration-200
                             shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30
                             disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled
                >
                    <Lock className="w-4 h-4" />
                    Request Early Access
                </button>
            </div>
        </Card>
    );
}

/**
 * Feature Preview Card
 */
function FeaturePreview({ icon, label }: { icon: React.ReactNode; label: string }) {
    return (
        <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="text-indigo-400 mb-2">{icon}</div>
            <p className="text-xs text-slate-400">{label}</p>
        </div>
    );
}

export default AIInsightsSection;

