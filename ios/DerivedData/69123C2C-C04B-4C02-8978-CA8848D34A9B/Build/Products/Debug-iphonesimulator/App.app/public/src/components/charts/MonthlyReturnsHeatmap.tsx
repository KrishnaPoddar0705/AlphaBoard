import React from 'react';

interface MonthlyReturnsHeatmapProps {
    data: Array<{ year: number; month: number; return_pct: number }>;
}

export const MonthlyReturnsHeatmap: React.FC<MonthlyReturnsHeatmapProps> = ({ data }) => {
    // Organize data by year
    const dataByYear: Record<number, Record<number, number>> = {};
    
    data.forEach(item => {
        if (!dataByYear[item.year]) {
            dataByYear[item.year] = {};
        }
        dataByYear[item.year][item.month] = item.return_pct;
    });

    const years = Object.keys(dataByYear).map(Number).sort();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const getCellColor = (value: number) => {
        if (value > 0) {
            // Green shades for positive returns
            const intensity = Math.min(Math.abs(value) / 10, 1);
            return `rgba(16, 185, 129, ${0.3 + intensity * 0.7})`;
        } else if (value < 0) {
            // Red shades for negative returns
            const intensity = Math.min(Math.abs(value) / 10, 1);
            return `rgba(239, 68, 68, ${0.3 + intensity * 0.7})`;
        }
        return 'rgba(255, 255, 255, 0.05)';
    };

    const getTextColor = (value: number) => {
        if (value === 0) return 'rgba(255, 255, 255, 0.3)';
        return 'rgba(255, 255, 255, 0.9)';
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse">
                <thead>
                    <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase border-b border-white/10">Year</th>
                        {months.map(month => (
                            <th key={month} className="px-2 py-2 text-center text-xs font-medium text-gray-400 uppercase border-b border-white/10">
                                {month}
                            </th>
                        ))}
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 uppercase border-b border-white/10">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {years.map(year => {
                        const yearData = dataByYear[year];
                        const total = Object.values(yearData).reduce((sum, val) => {
                            // Compound monthly returns
                            return sum * (1 + val / 100);
                        }, 1) - 1;
                        const totalPct = total * 100;

                        return (
                            <tr key={year} className="hover:bg-white/5 transition-colors">
                                <td className="px-3 py-2 text-sm font-medium text-white border-b border-white/5">{year}</td>
                                {months.map((_, monthIdx) => {
                                    const month = monthIdx + 1;
                                    const value = yearData[month] || 0;
                                    return (
                                        <td
                                            key={month}
                                            className="px-2 py-2 text-center text-xs border-b border-white/5"
                                            style={{
                                                backgroundColor: getCellColor(value),
                                                color: getTextColor(value)
                                            }}
                                        >
                                            {value !== 0 ? `${value >= 0 ? '+' : ''}${value.toFixed(2)}%` : '-'}
                                        </td>
                                    );
                                })}
                                <td
                                    className="px-3 py-2 text-right text-sm font-medium border-b border-white/5"
                                    style={{
                                        color: totalPct >= 0 ? '#10b981' : '#ef4444'
                                    }}
                                >
                                    {totalPct >= 0 ? '+' : ''}{totalPct.toFixed(2)}%
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

