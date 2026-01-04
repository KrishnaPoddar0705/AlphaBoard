import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Download, Loader2, X, Save, Check } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { savePodcast } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

interface PodcastPlayerProps {
    podcastTitle: string;
    script: string;
    audioBase64?: string;
    keyPoints?: string[];
    highlights?: Array<{ ticker: string; summary: string }>;
    duration?: string;
    onClose?: () => void;
    // Metadata for saving
    ticker?: string;
    companyName?: string;
    podcastType?: 'single-stock' | 'portfolio';
    weekStart?: string;
    weekEnd?: string;
}

export default function PodcastPlayer({
    podcastTitle,
    script,
    audioBase64,
    keyPoints,
    highlights,
    duration,
    onClose,
    ticker,
    companyName,
    podcastType,
    weekStart,
    weekEnd,
}: PodcastPlayerProps) {
    const { session } = useAuth();
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [durationSeconds, setDurationSeconds] = useState(0);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Create blob URL from base64 audio
    useEffect(() => {
        if (audioBase64) {
            try {
                const binaryString = atob(audioBase64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const blob = new Blob([bytes], { type: 'audio/mpeg' });
                const url = URL.createObjectURL(blob);
                setAudioUrl(url);

                return () => {
                    URL.revokeObjectURL(url);
                };
            } catch (error) {
            }
        }
    }, [audioBase64]);

    // Set up audio element
    useEffect(() => {
        if (audioUrl && !audioRef.current) {
            const audio = new Audio(audioUrl);
            audioRef.current = audio;

            audio.addEventListener('loadedmetadata', () => {
                setDurationSeconds(audio.duration);
            });

            audio.addEventListener('timeupdate', () => {
                setCurrentTime(audio.currentTime);
            });

            audio.addEventListener('ended', () => {
                setIsPlaying(false);
                setCurrentTime(0);
            });

            return () => {
                audio.removeEventListener('loadedmetadata', () => {});
                audio.removeEventListener('timeupdate', () => {});
                audio.removeEventListener('ended', () => {});
                audio.pause();
                audio.src = '';
            };
        }
    }, [audioUrl]);

    const togglePlayPause = () => {
        if (!audioRef.current) return;

        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            audioRef.current.play();
            setIsPlaying(true);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!audioRef.current) return;
        const newTime = parseFloat(e.target.value);
        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
    };

    const handleDownload = () => {
        if (!audioBase64) return;

        try {
            const binaryString = atob(audioBase64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: 'audio/mpeg' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${podcastTitle.replace(/[^a-z0-9]/gi, '_')}.mp3`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
        }
    };

    const handleSave = async () => {
        if (!session?.user?.id) {
            alert('Please log in to save podcasts');
            return;
        }

        if (!podcastType) {
            alert('Cannot save: Missing podcast type information');
            return;
        }

        setSaving(true);
        try {
            const podcastData: any = {
                user_id: session.user.id,
                podcast_type: podcastType,
                podcast_title: podcastTitle,
                script: script,
                audio_base64: audioBase64,
                duration: duration || '',
            };

            if (podcastType === 'single-stock') {
                if (ticker) podcastData.ticker = ticker;
                if (companyName) podcastData.company_name = companyName;
                if (keyPoints) podcastData.key_points = keyPoints;
            } else if (podcastType === 'portfolio') {
                if (highlights) podcastData.highlights = highlights;
                if (weekStart) podcastData.week_start = weekStart;
                if (weekEnd) podcastData.week_end = weekEnd;
            }

            await savePodcast(podcastData);
            setSaved(true);
            // Trigger refresh event
            setTimeout(() => {
                window.dispatchEvent(new Event('podcast-refresh'));
            }, 500);
            
            setTimeout(() => setSaved(false), 3000); // Reset saved state after 3 seconds
        } catch (error: any) {
            alert(`Failed to save podcast: ${error.message || 'Unknown error'}`);
        } finally {
            setSaving(false);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Progress calculation (currently unused but kept for future use)
    // const _progress = durationSeconds > 0 ? (currentTime / durationSeconds) * 100 : 0;

    return (
        <Card variant="glass" padding="md" className="w-full max-w-2xl mx-auto">
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <CardTitle className="text-lg font-bold text-white mb-1">
                            {podcastTitle}
                        </CardTitle>
                        {duration && (
                            <p className="text-xs text-slate-400">{duration}</p>
                        )}
                    </div>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Audio Player Controls */}
                {audioBase64 && audioUrl ? (
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={togglePlayPause}
                                className="flex-shrink-0 w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-500 
                                         text-white flex items-center justify-center transition-colors
                                         shadow-lg shadow-indigo-500/30"
                            >
                                {isPlaying ? (
                                    <Pause className="w-6 h-6" />
                                ) : (
                                    <Play className="w-6 h-6 ml-1" />
                                )}
                            </button>

                            <div className="flex-1 space-y-1">
                                <input
                                    type="range"
                                    min="0"
                                    max={durationSeconds || 0}
                                    value={currentTime}
                                    onChange={handleSeek}
                                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer
                                             accent-indigo-500"
                                />
                                <div className="flex justify-between text-xs text-slate-400">
                                    <span>{formatTime(currentTime)}</span>
                                    <span>{formatTime(durationSeconds)}</span>
                                </div>
                            </div>

                            <button
                                onClick={handleDownload}
                                className="flex-shrink-0 px-4 py-2 bg-slate-700 hover:bg-slate-600 
                                         text-white rounded-lg transition-colors flex items-center gap-2"
                                title="Download MP3"
                            >
                                <Download className="w-4 h-4" />
                                <span className="hidden sm:inline">Download</span>
                            </button>
                            
                            {session?.user?.id && (
                                <button
                                    onClick={handleSave}
                                    disabled={saving || saved}
                                    className={`flex-shrink-0 px-4 py-2 rounded-lg transition-colors flex items-center gap-2
                                             ${saved 
                                                 ? 'bg-emerald-600 text-white' 
                                                 : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                                             }
                                             disabled:opacity-50 disabled:cursor-not-allowed`}
                                    title="Save Podcast"
                                >
                                    {saving ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span className="hidden sm:inline">Saving...</span>
                                        </>
                                    ) : saved ? (
                                        <>
                                            <Check className="w-4 h-4" />
                                            <span className="hidden sm:inline">Saved</span>
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4" />
                                            <span className="hidden sm:inline">Save</span>
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 text-center">
                        <p className="text-slate-400 text-sm">
                            Audio generation unavailable. Script is available below.
                        </p>
                    </div>
                )}

                {/* Script */}
                <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-indigo-400 uppercase tracking-wider">
                        Script
                    </h3>
                    <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                        <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">
                            {script}
                        </p>
                    </div>
                </div>

                {/* Key Points (for single-stock) */}
                {keyPoints && keyPoints.length > 0 && (
                    <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-indigo-400 uppercase tracking-wider">
                            Key Points
                        </h3>
                        <ul className="space-y-1">
                            {keyPoints.map((point, idx) => (
                                <li
                                    key={idx}
                                    className="text-slate-300 text-sm flex items-start gap-2"
                                >
                                    <span className="text-indigo-400 mt-1">•</span>
                                    <span>{point}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Highlights (for portfolio) */}
                {highlights && highlights.length > 0 && (
                    <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-indigo-400 uppercase tracking-wider">
                            Portfolio Highlights
                        </h3>
                        <div className="space-y-2">
                            {highlights.map((highlight, idx) => (
                                <div
                                    key={idx}
                                    className="p-3 bg-slate-800/50 rounded-lg border border-slate-700"
                                >
                                    <div className="font-semibold text-white text-sm mb-1">
                                        {highlight.ticker}
                                    </div>
                                    <div className="text-slate-300 text-sm">
                                        {highlight.summary}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

