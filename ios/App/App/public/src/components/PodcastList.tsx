import React, { useState, useEffect } from 'react';
import { Play, Trash2, Clock, Mic, Loader2 } from 'lucide-react';
import { getPodcasts, deletePodcast } from '../lib/api';
import PodcastPlayer from './PodcastPlayer';

interface PodcastListProps {
    userId: string;
    ticker?: string;
    podcastType?: 'single-stock' | 'portfolio';
    onPodcastSelect?: (podcast: any) => void;
}

export default function PodcastList({
    userId,
    ticker,
    podcastType,
    onPodcastSelect,
}: PodcastListProps) {
    const [podcasts, setPodcasts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPodcast, setSelectedPodcast] = useState<any>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        if (userId) {
            fetchPodcasts();
        }
    }, [userId, ticker, podcastType]);

    // Listen for refresh events
    useEffect(() => {
        const handleRefresh = () => {
            if (userId) {
                fetchPodcasts();
            }
        };
        window.addEventListener('podcast-refresh', handleRefresh);
        return () => window.removeEventListener('podcast-refresh', handleRefresh);
    }, [userId]);

    // Listen for close events to clear internal state
    useEffect(() => {
        const handleClose = () => {
            setSelectedPodcast(null);
        };
        window.addEventListener('podcast-close', handleClose);
        return () => window.removeEventListener('podcast-close', handleClose);
    }, []);

    const fetchPodcasts = async () => {
        setLoading(true);
        try {
            const data = await getPodcasts(userId, podcastType, ticker);
            setPodcasts(data.podcasts || []);
        } catch (error) {
            console.error('Error fetching podcasts:', error);
            setPodcasts([]);
        } finally {
            setLoading(false);
        }
    };

    const handlePlay = (podcast: any) => {
        // Convert database format to PodcastPlayer format
        const podcastData = {
            podcastTitle: podcast.podcast_title,
            script: podcast.script,
            audioBase64: podcast.audio_base64,
            keyPoints: podcast.key_points || [],
            highlights: podcast.highlights || [],
            duration: podcast.duration,
            // Include metadata for saving
            ticker: podcast.ticker,
            companyName: podcast.company_name,
            podcastType: podcast.podcast_type,
            weekStart: podcast.week_start,
            weekEnd: podcast.week_end,
        };
        
        // If parent provides onPodcastSelect, use that instead of internal modal
        if (onPodcastSelect) {
            onPodcastSelect(podcastData);
            // Don't set internal state when parent handles it
        } else {
            // Only use internal modal if no parent handler
            setSelectedPodcast(podcastData);
        }
    };

    const handleDelete = async (podcastId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!window.confirm('Are you sure you want to delete this podcast?')) return;

        setDeletingId(podcastId);
        try {
            await deletePodcast(podcastId, userId);
            setPodcasts(podcasts.filter(p => p.id !== podcastId));
        } catch (error) {
            console.error('Error deleting podcast:', error);
            alert('Failed to delete podcast');
        } finally {
            setDeletingId(null);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
            </div>
        );
    }

    if (podcasts.length === 0) {
        return (
            <div className="text-center py-8">
                <Mic className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">No saved podcasts yet</p>
                <p className="text-slate-500 text-xs mt-1">Generate a podcast to save it here</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {selectedPodcast && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                        <PodcastPlayer
                            {...selectedPodcast}
                            onClose={() => setSelectedPodcast(null)}
                        />
                    </div>
                </div>
            )}

            {podcasts.map((podcast) => (
                <div
                    key={podcast.id}
                    onClick={() => handlePlay(podcast)}
                    className="group p-4 bg-white/5 rounded-lg border border-white/10 
                             hover:border-indigo-500/50 cursor-pointer transition-all"
                >
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="text-white font-semibold text-sm truncate">
                                    {podcast.podcast_title}
                                </h4>
                                {podcast.ticker && (
                                    <span className="text-xs text-indigo-400 font-mono flex-shrink-0">
                                        {podcast.ticker}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-400">
                                <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {podcast.duration}
                                </span>
                                <span>•</span>
                                <span>{formatDate(podcast.created_at)}</span>
                            </div>
                            {podcast.company_name && (
                                <p className="text-xs text-slate-500 mt-1 truncate">
                                    {podcast.company_name}
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handlePlay(podcast);
                                }}
                                className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg 
                                         transition-colors opacity-0 group-hover:opacity-100"
                                title="Play Podcast"
                            >
                                <Play className="w-4 h-4" />
                            </button>
                            <button
                                onClick={(e) => handleDelete(podcast.id, e)}
                                disabled={deletingId === podcast.id}
                                className="p-2 bg-slate-700 hover:bg-rose-600 text-white rounded-lg 
                                         transition-colors opacity-0 group-hover:opacity-100
                                         disabled:opacity-50"
                                title="Delete Podcast"
                            >
                                {deletingId === podcast.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Trash2 className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

