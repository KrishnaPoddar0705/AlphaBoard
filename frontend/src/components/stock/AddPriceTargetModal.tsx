/**
 * AddPriceTargetModal Component
 * 
 * Modal for adding a new price target to the timeline.
 * 
 * @component
 */

import { useState } from 'react';
import { X, Target, Calendar } from 'lucide-react';

interface AddPriceTargetModalProps {
    ticker: string;
    onClose: () => void;
    onSubmit: (targetPrice: number, targetDate: string | null) => Promise<void>;
}

export function AddPriceTargetModal({ ticker, onClose, onSubmit }: AddPriceTargetModalProps) {
    const [targetPrice, setTargetPrice] = useState<string>('');
    const [targetDate, setTargetDate] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!targetPrice || parseFloat(targetPrice) <= 0) {
            setError('Please enter a valid price target');
            return;
        }

        try {
            setLoading(true);
            await onSubmit(
                parseFloat(targetPrice),
                targetDate || null
            );
        } catch (err: any) {
            setError(err.message || 'Failed to add price target');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed z-50 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                <div className="inline-block align-bottom bg-[#1e293b] rounded-2xl text-left overflow-visible shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-white/10 relative">
                    <div className="px-6 py-6">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-2">
                                <Target className="w-5 h-5 text-indigo-400" />
                                <h3 className="text-xl font-bold text-white">
                                    Add Price Target
                                </h3>
                            </div>
                            <button 
                                onClick={onClose} 
                                className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-full"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="mb-4">
                            <p className="text-sm text-gray-400">
                                Adding price target for <span className="font-semibold text-white">{ticker}</span>
                            </p>
                        </div>

                        {error && (
                            <div className="mb-4 p-3 rounded bg-red-500/20 border border-red-500/30 text-red-200 text-sm flex items-center gap-2">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                                    Target Price <span className="text-red-400">*</span>
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <span className="text-gray-400 sm:text-sm">₹</span>
                                    </div>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={targetPrice}
                                        onChange={(e) => setTargetPrice(e.target.value)}
                                        className="block w-full pl-7 pr-3 py-2.5 border border-white/10 rounded-lg bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 sm:text-sm transition-all"
                                        placeholder="0.00"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar className="w-4 h-4" />
                                        Time Horizon (Optional)
                                    </div>
                                </label>
                                <input
                                    type="date"
                                    value={targetDate}
                                    onChange={(e) => setTargetDate(e.target.value)}
                                    className="block w-full px-3 py-2.5 border border-white/10 rounded-lg bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 sm:text-sm transition-all"
                                    min={new Date().toISOString().split('T')[0]}
                                />
                                <p className="mt-1.5 text-xs text-gray-400">
                                    Set a target date to track time remaining for this price target
                                </p>
                            </div>

                            <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-white/10">
                                <button
                                    type="button"
                                    onClick={onClose}
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
                                            Adding...
                                        </>
                                    ) : (
                                        'Add Price Target'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

