import React, { useMemo } from 'react';
import { ResponsiveCalendar } from '@nivo/calendar';

interface DailyReturnsCalendarProps {
    data: Array<{ day: string; value: number }>;
}

export const DailyReturnsCalendar: React.FC<DailyReturnsCalendarProps> = ({ data }) => {
    // Create a map for quick lookup in tooltip (includes all values including 0)
    const dataMap = useMemo(() => {
        const map = new Map<string, number>();
        if (data) {
            data.forEach(d => {
                // Store all values, treating null/undefined/NaN as 0
                const value = (d.value !== null && d.value !== undefined && !isNaN(d.value)) ? d.value : 0;
                map.set(d.day, value);
            });
        }
        return map;
    }, [data]);

    // Filter data to exclude zero values (they'll show as empty)
    const filteredData = useMemo(() => {
        if (!data) return [];
        return data.filter(d => d.value !== 0 && d.value !== null && d.value !== undefined && !isNaN(d.value));
    }, [data]);

    // Calculate date range from data
    const { from, to } = useMemo(() => {
        if (!data || data.length === 0) {
            const today = new Date();
            const oneYearAgo = new Date(today);
            oneYearAgo.setFullYear(today.getFullYear() - 1);
            return {
                from: oneYearAgo.toISOString().split('T')[0],
                to: today.toISOString().split('T')[0]
            };
        }

        const dates = data.map(d => d.day).sort();
        return {
            from: dates[0],
            to: dates[dates.length - 1]
        };
    }, [data]);

    // Calculate symmetric min/max for diverging color scale (centered on zero)
    const { min, max } = useMemo(() => {
        if (!filteredData || filteredData.length === 0) return { min: -5, max: 5 };
        const values = filteredData.map(d => d.value);
        const minVal = Math.min(...values);
        const maxVal = Math.max(...values);
        const absMax = Math.max(Math.abs(minVal), Math.abs(maxVal));

        // Make the scale symmetric around zero for better color mapping
        // This ensures zero is always in the middle of the color scale
        return {
            min: -absMax,
            max: absMax
        };
    }, [filteredData]);

    // Theme with Editorial Paper Terminal colors
    const theme = {
        textColor: '#1C1B17', // ink text
        fontSize: 11,
        labels: {
            text: {
                fill: '#6F6A60' // muted
            }
        }
    };

    return (
        <div className="w-full" style={{ height: '400px' }}>
            <ResponsiveCalendar
                data={filteredData}
                from={from}
                to={to}
                emptyColor="#FBF7ED" // alt bg
                colors={['#B23B2A', '#F09070', '#86EFAC', '#2F8F5B']} // solid red, light red, light green, solid green
                minValue={min}
                maxValue={max}
                margin={{ top: 40, right: 40, bottom: 40, left: 40 }}
                yearSpacing={40}
                monthBorderColor="#D7D0C2" // border
                dayBorderWidth={1}
                dayBorderColor="#E3DDCF" // gridlines
                theme={theme}
                legends={[
                    {
                        anchor: 'bottom-right',
                        direction: 'row',
                        translateY: 36,
                        itemCount: 4,
                        itemWidth: 42,
                        itemHeight: 36,
                        itemsSpacing: 14,
                        itemDirection: 'right-to-left'
                    }
                ]}
                tooltip={({ day }) => {
                    // Always show the return value from our data map (includes 0 for missing)
                    const returnValue = dataMap.get(day) ?? 0;
                    const numValue = Number(returnValue);

                    return (
                        <div className="bg-[#F7F2E6] border border-[#D7D0C2] rounded-lg px-3 py-2 text-sm font-mono">
                            <strong className="text-[#1C1B17]">{day}</strong>
                            <div className="text-[#6F6A60] mt-1">Daily Return:</div>
                            <div className={`font-semibold tabular-nums ${numValue >= 0 ? 'text-[#2F8F5B]' : numValue < 0 ? 'text-[#B23B2A]' : 'text-[#6F6A60]'}`}>
                                {numValue >= 0 ? '+' : ''}{numValue.toFixed(2)}%
                            </div>
                        </div>
                    );
                }}
            />
        </div>
    );
};

