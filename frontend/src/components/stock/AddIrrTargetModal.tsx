/**
 * AddIrrTargetModal Component
 *
 * Modal for adding a new IRR target to the timeline. Analysts publish an expected
 * annualised IRR over a horizon bucket rather than an absolute price target, so
 * both values are captured together and submitted as a pair.
 *
 * @component
 */

import { useState } from 'react';
import { X, Target, Clock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
    IRR_TIMEFRAMES,
    DEFAULT_IRR_TIMEFRAME,
    getTimeframe,
    validateIrr,
    type IrrTimeframe,
} from '../../lib/irrTargets';

interface AddIrrTargetModalProps {
    ticker: string;
    onClose: () => void;
    onSubmit: (targetIrr: number, timeframe: IrrTimeframe) => Promise<void>;
}

export function AddIrrTargetModal({ ticker, onClose, onSubmit }: AddIrrTargetModalProps) {
    const [targetIrr, setTargetIrr] = useState<string>('');
    const [timeframe, setTimeframe] = useState<string>(DEFAULT_IRR_TIMEFRAME);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const parsed = validateIrr(targetIrr);
        if ('error' in parsed) {
            setError(parsed.error);
            return;
        }

        const selectedTimeframe = getTimeframe(timeframe);
        if (!selectedTimeframe) {
            setError('Please select a timeframe');
            return;
        }

        try {
            setLoading(true);
            await onSubmit(parsed.value, selectedTimeframe);
        } catch (err: any) {
            setError(err.message || 'Failed to add IRR target');
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
                                    Add IRR Target
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
                                Adding IRR target for <span className="font-semibold text-[#1C1B17]">{ticker}</span>
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
                                    IRR Target <span className="text-[#B23B2A]">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.1"
                                        required
                                        value={targetIrr}
                                        onChange={(e) => setTargetIrr(e.target.value)}
                                        className="block w-full pl-3 pr-8 py-2.5 border border-[#D7D0C2] rounded-lg bg-[#FBF7ED] text-[#1C1B17] placeholder-[#6F6A60] focus:outline-none focus:ring-2 focus:ring-[#1C1B17]/20 focus:border-[#1C1B17] sm:text-sm font-mono tabular-nums transition-all"
                                        placeholder="0.0"
                                        autoFocus
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                        <span className="text-[#6F6A60] sm:text-sm font-mono">%</span>
                                    </div>
                                </div>
                                <p className="mt-1.5 text-xs font-mono text-[#6F6A60]">
                                    Expected annualised return over the selected timeframe
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-mono font-medium text-[#1C1B17] mb-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <Clock className="w-4 h-4" />
                                        Timeframe <span className="text-[#B23B2A]">*</span>
                                    </div>
                                </label>
                                <Select value={timeframe} onValueChange={setTimeframe}>
                                    <SelectTrigger className="w-full h-auto px-3 py-2.5 rounded-lg border-[#D7D0C2] bg-[#FBF7ED] text-[#1C1B17] font-mono sm:text-sm">
                                        <SelectValue placeholder="Select timeframe" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-60 bg-[#FBF7ED] border-[#D7D0C2] text-[#1C1B17]">
                                        {IRR_TIMEFRAMES.map((tf) => (
                                            <SelectItem
                                                key={tf.value}
                                                value={tf.value}
                                                className="font-mono focus:bg-[#F1EEE0] focus:text-[#1C1B17]"
                                            >
                                                {tf.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="mt-1.5 text-xs font-mono text-[#6F6A60]">
                                    Horizon over which the IRR is expected to be achieved
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
                                        'Add IRR Target'
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
