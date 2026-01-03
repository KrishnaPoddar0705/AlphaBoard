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
        if (value === 0) {
            return '#FBF7ED'; // alt bg for zero/no data
        }
        
        // Calculate absolute value and determine intensity
        const absValue = Math.abs(value);
        const threshold = 2.0; // Threshold to determine solid vs light color
        
        if (value > 0) {
            // Positive returns: light green for small, solid green for large
            return absValue >= threshold ? '#2F8F5B' : '#86EFAC'; // solid green or light green
        } else {
            // Negative returns: light red for small, solid red for large
            return absValue >= threshold ? '#B23B2A' : '#F09070'; // solid red or light red
        }
    };

    const getTextColor = (value: number) => {
        if (value === 0) return '#6F6A60'; // muted
        return '#1C1B17'; // ink text
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse font-mono">
                <thead>
                    <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-[#6F6A60] uppercase border-b border-[#D7D0C2] bg-[#F7F2E6]">Year</th>
                        {months.map(month => (
                            <th key={month} className="px-2 py-2 text-center text-xs font-medium text-[#6F6A60] uppercase border-b border-[#D7D0C2] bg-[#F7F2E6]">
                                {month}
                            </th>
                        ))}
                        <th className="px-3 py-2 text-right text-xs font-medium text-[#6F6A60] uppercase border-b border-[#D7D0C2] bg-[#F7F2E6]">Total</th>
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
                            <tr key={year} className="hover:bg-[#FBF7ED] transition-colors">
                                <td className="px-3 py-2 text-sm font-medium text-[#1C1B17] border-b border-[#E3DDCF]">{year}</td>
                                {months.map((_, monthIdx) => {
                                    const month = monthIdx + 1;
                                    const value = yearData[month] || 0;
                                    return (
                                        <td
                                            key={month}
                                            className="px-2 py-2 text-center text-xs border-b border-[#E3DDCF] tabular-nums"
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
                                    className="px-3 py-2 text-right text-sm font-medium border-b border-[#E3DDCF] tabular-nums"
                                    style={{
                                        color: totalPct >= 0 ? '#2F8F5B' : '#B23B2A'
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

