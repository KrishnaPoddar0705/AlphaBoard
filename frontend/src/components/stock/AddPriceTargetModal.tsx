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
                <div className="inline-block align-bottom bg-[#F7F2E6] rounded-lg text-left overflow-visible shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-[#D7D0C2] relative">
                    <div className="px-6 py-6">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-2">
                                <Target className="w-5 h-5 text-[#1C1B17]" />
                                <h3 className="text-xl font-mono font-bold text-[#1C1B17]">
                                    Add Price Target
                                </h3>
                            </div>
                            <button 
                                onClick={onClose} 
                                className="text-[#6F6A60] hover:text-[#1C1B17] transition-colors p-1 hover:bg-[#FBF7ED] rounded-full"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="mb-4">
                            <p className="text-sm font-mono text-[#6F6A60]">
                                Adding price target for <span className="font-semibold text-[#1C1B17]">{ticker}</span>
                            </p>
                        </div>

                        {error && (
                            <div className="mb-4 p-3 rounded bg-[#B23B2A]/10 border border-[#B23B2A] text-[#B23B2A] font-mono text-sm flex items-center gap-2">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="block text-sm font-mono font-medium text-[#1C1B17] mb-1.5">
                                    Target Price <span className="text-[#B23B2A]">*</span>
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <span className="text-[#6F6A60] sm:text-sm font-mono">$</span>
                                    </div>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={targetPrice}
                                        onChange={(e) => setTargetPrice(e.target.value)}
                                        className="block w-full pl-7 pr-3 py-2.5 border border-[#D7D0C2] rounded-lg bg-[#FBF7ED] text-[#1C1B17] placeholder-[#6F6A60] focus:outline-none focus:ring-2 focus:ring-[#1C1B17]/20 focus:border-[#1C1B17] sm:text-sm font-mono tabular-nums transition-all"
                                        placeholder="0.00"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-mono font-medium text-[#1C1B17] mb-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar className="w-4 h-4" />
                                        Time Horizon (Optional)
                                    </div>
                                </label>
                                <input
                                    type="date"
                                    value={targetDate}
                                    onChange={(e) => setTargetDate(e.target.value)}
                                    className="block w-full px-3 py-2.5 border border-[#D7D0C2] rounded-lg bg-[#FBF7ED] text-[#1C1B17] placeholder-[#6F6A60] focus:outline-none focus:ring-2 focus:ring-[#1C1B17]/20 focus:border-[#1C1B17] sm:text-sm font-mono transition-all"
                                    min={new Date().toISOString().split('T')[0]}
                                />
                                <p className="mt-1.5 text-xs font-mono text-[#6F6A60]">
                                    Set a target date to track time remaining for this price target
                                </p>
                            </div>

                            <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-[#D7D0C2]">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 text-sm font-mono font-medium text-[#1C1B17] bg-transparent border border-[#D7D0C2] rounded-lg hover:bg-[#FBF7ED] focus:outline-none focus:ring-2 focus:ring-[#1C1B17]/20 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-6 py-2 text-sm font-mono font-medium text-[#F7F2E6] bg-[#1C1B17] rounded-lg hover:bg-[#1C1B17]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1C1B17] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-[#F7F2E6]/30 border-t-[#F7F2E6] rounded-full animate-spin"></div>
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

