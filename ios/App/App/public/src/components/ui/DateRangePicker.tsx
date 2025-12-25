import { useState, useEffect } from 'react';

interface DateRangePickerProps {
    startDate: string;
    endDate: string;
    onStartDateChange: (date: string) => void;
    onEndDateChange: (date: string) => void;
    className?: string;
}

export default function DateRangePicker({
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
    className = '',
}: DateRangePickerProps) {
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            if (end < start) {
                setError('End date must be after start date');
            } else {
                setError(null);
            }
        }
    }, [startDate, endDate]);

    // Set default to last 7 days if not provided
    useEffect(() => {
        if (!startDate || !endDate) {
            const end = new Date();
            const start = new Date();
            start.setDate(start.getDate() - 7);
            
            onStartDateChange(start.toISOString().split('T')[0]);
            onEndDateChange(end.toISOString().split('T')[0]);
        }
    }, []);

    return (
        <div className={`space-y-3 ${className}`}>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                        Start Date
                    </label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => onStartDateChange(e.target.value)}
                        className="block w-full px-3 py-2 border border-white/10 rounded-lg 
                                 bg-white/5 text-white placeholder-gray-500 
                                 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 
                                 focus:border-indigo-500 sm:text-sm transition-all"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                        End Date
                    </label>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => onEndDateChange(e.target.value)}
                        className="block w-full px-3 py-2 border border-white/10 rounded-lg 
                                 bg-white/5 text-white placeholder-gray-500 
                                 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 
                                 focus:border-indigo-500 sm:text-sm transition-all"
                    />
                </div>
            </div>
            {error && (
                <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 
                              rounded-lg px-3 py-2">
                    {error}
                </div>
            )}
        </div>
    );
}

