import { useState, useEffect, useRef } from 'react';
import { Bell, X, TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface PriceAlert {
    id: string;
    ticker: string;
    alert_type: 'BUY' | 'SELL';
    trigger_price: number;
    current_price: number;
    message: string;
    is_read: boolean;
    created_at: string;
}

export default function AlertsDropdown() {
    const { session } = useAuth();
    const [alerts, setAlerts] = useState<PriceAlert[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (session?.user?.id) {
            fetchAlerts();
            // Poll for new alerts every 30 seconds
            const interval = setInterval(fetchAlerts, 30000);
            return () => clearInterval(interval);
        }
    }, [session?.user?.id]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const fetchAlerts = async () => {
        if (!session?.user?.id) return;

        try {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('price_alerts')
                .select('*')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setAlerts(data || []);
        } catch (err) {
        } finally {
            setIsLoading(false);
        }
    };

    const markAsRead = async (alertId: string) => {
        if (!session?.user?.id) return;

        try {
            const { error } = await supabase
                .from('price_alerts')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq('id', alertId)
                .eq('user_id', session.user.id);

            if (error) throw error;

            setAlerts(prev => prev.map(alert =>
                alert.id === alertId ? { ...alert, is_read: true } : alert
            ));
        } catch (err) {
        }
    };

    const deleteAlert = async (alertId: string) => {
        if (!session?.user?.id) return;

        try {
            const { error } = await supabase
                .from('price_alerts')
                .delete()
                .eq('id', alertId)
                .eq('user_id', session.user.id);

            if (error) throw error;

            setAlerts(prev => prev.filter(alert => alert.id !== alertId));
        } catch (err) {
        }
    };

    const markAllAsRead = async () => {
        if (!session?.user?.id) return;

        try {
            const unreadIds = alerts.filter(a => !a.is_read).map(a => a.id);
            if (unreadIds.length === 0) return;

            const { error } = await supabase
                .from('price_alerts')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .in('id', unreadIds)
                .eq('user_id', session.user.id);

            if (error) throw error;

            setAlerts(prev => prev.map(alert =>
                !alert.is_read ? { ...alert, is_read: true } : alert
            ));
        } catch (err) {
        }
    };

    const unreadCount = alerts.filter(a => !a.is_read).length;

    if (!session?.user?.id) return null;

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors rounded-lg hover:bg-white/5"
                aria-label="Alerts"
            >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-96 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl shadow-2xl z-50 max-h-[600px] flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
                        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Price Alerts</h3>
                        <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                                >
                                    Mark all read
                                </button>
                            )}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 hover:bg-white/10 rounded transition-colors"
                            >
                                <X className="w-4 h-4 text-[var(--text-secondary)]" />
                            </button>
                        </div>
                    </div>

                    {/* Alerts List */}
                    <div className="overflow-y-auto flex-1">
                        {isLoading ? (
                            <div className="p-8 text-center text-[var(--text-secondary)]">
                                Loading alerts...
                            </div>
                        ) : alerts.length === 0 ? (
                            <div className="p-8 text-center text-[var(--text-secondary)]">
                                <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                <p>No alerts yet</p>
                                <p className="text-sm mt-1">You'll be notified when stocks hit your price targets</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-[var(--border-color)]">
                                {alerts.map((alert) => (
                                    <div
                                        key={alert.id}
                                        className={`p-4 hover:bg-white/5 transition-colors ${
                                            !alert.is_read ? 'bg-indigo-500/10' : ''
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`flex-shrink-0 mt-1 ${
                                                alert.alert_type === 'BUY' ? 'text-emerald-400' : 'text-rose-400'
                                            }`}>
                                                {alert.alert_type === 'BUY' ? (
                                                    <TrendingDown className="w-5 h-5" />
                                                ) : (
                                                    <TrendingUp className="w-5 h-5" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="font-semibold text-[var(--text-primary)]">
                                                        {alert.ticker}
                                                    </span>
                                                    {!alert.is_read && (
                                                        <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-[var(--text-secondary)] mb-2">
                                                    {alert.message}
                                                </p>
                                                <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                                                    <span>
                                                        {new Date(alert.created_at).toLocaleString()}
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        {!alert.is_read && (
                                                            <button
                                                                onClick={() => markAsRead(alert.id)}
                                                                className="text-indigo-400 hover:text-indigo-300 transition-colors"
                                                            >
                                                                Mark read
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => deleteAlert(alert.id)}
                                                            className="text-rose-400 hover:text-rose-300 transition-colors"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}


