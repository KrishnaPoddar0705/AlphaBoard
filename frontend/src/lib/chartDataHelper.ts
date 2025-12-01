import { format } from 'd3-format';
import { timeFormat } from 'd3-time-format';

// Helper to format real data into chart-friendly shapes
export const generateChartData = (chartId: number, chartType: string, dataShown: string[], realData: any) => {

    if (!realData) return [];

    // Technical Charts (Highcharts)
    if (realData.chartData && (chartId <= 10 || chartId >= 36)) {
        // For Volatility/Risk charts that might use daily data
        if (chartType.includes('Volatility') || chartType.includes('Risk')) {
            // Calculate daily returns
            return realData.chartData.map((d: any, i: number, arr: any[]) => {
                const prev = i > 0 ? arr[i - 1] : d;
                const change = prev.close > 0 ? ((d.close - prev.close) / prev.close) * 100 : 0;
                return {
                    ...d,
                    daily_price_change: change,
                    daily_returns: change, // For heatmap
                    volatility: Math.abs(change) // Simplified
                };
            });
        }

        return realData.chartData.map((d: any) => ({
            ...d,
            adjusted_close: d.close,
            smoothed_price_trend: d.close,
            price_change_percent: d.open > 0 ? ((d.close - d.open) / d.open) * 100 : 0
        }));
    }

    const income = realData.incomeStatement || [];
    const balance = realData.balanceSheet || [];
    const cash = realData.cashFlow || [];
    const quarterly = realData.quarterly || [];
    const dividends = realData.dividends || [];
    const earnings = realData.earnings || [];
    const summary = realData.financials || {};

    // 12. Revenue Trend
    if (chartType.includes('Revenue Trend')) {
        return quarterly.map((d: any) => ({ ...d, revenue_quarterly: d.revenue, dateStr: d.year }));
    }

    // 13. Expense Trend
    if (chartType.includes('Expense')) {
        return income.map((d: any) => ({
            dateStr: d.year,
            cogs: d.cogs,
            rnd: d.rnd,
            sga: d.sga
        }));
    }

    // 14. Profit Margin Trend
    if (chartType.includes('Margin')) {
        return income.map((d: any) => ({
            id: d.year,
            gross_margin: d.revenue > 0 ? (d.gross_profit / d.revenue) * 100 : 0,
            operating_margin: d.revenue > 0 ? (d.operating_profit / d.revenue) * 100 : 0,
            net_margin: d.revenue > 0 ? (d.netProfit / d.revenue) * 100 : 0
        }));
    }

    // 15. EPS Trend
    if (chartType.includes('EPS')) {
        return income.map((d: any) => ({
            dateStr: d.year,
            eps: d.eps || (d.netProfit / 1000000000) // Fallback if EPS missing
        }));
    }

    // 16. Analyst Target vs Price
    if (chartType.includes('Target')) {
        // Compare recent price history with current target
        const target = summary.targetMeanPrice;
        const recentHistory = realData.chartData ? realData.chartData.slice(-30) : [];
        return recentHistory.map((d: any) => ({
            dateStr: d.date,
            price: d.close,
            analyst_target_price: target
        }));
    }

    // 17. PE Ratio Trend
    if (chartType.includes('PE Ratio')) {
        // Calculate PE based on Close / Annual EPS (latest available at that time)
        // Simplified: Just use current PE from summary for now as history is hard
        // Or map close price / latest EPS
        const latestEPS = income.length > 0 ? income[income.length - 1].eps : 0;
        if (latestEPS > 0 && realData.chartData) {
            return realData.chartData.filter((_: any, i: number) => i % 5 === 0).map((d: any) => ({ // Sample every 5th day
                dateStr: d.date,
                pe_ratio: d.close / latestEPS
            }));
        }
        return [];
    }

    // 18. Valuation Multiples (Radar) & 33. Risk Radar
    if (chartType.includes('Radar')) {
        if (chartType.includes('Risk')) {
            return [
                { "metric": "Volatility", "Stock": 50, "Sector": 40 }, // Mock relative
                { "metric": "Beta", "Stock": summary.beta || 1, "Sector": 1.0 },
                { "metric": "Drawdown", "Stock": 30, "Sector": 25 },
                { "metric": "Short Ratio", "Stock": summary.shortRatio || 0, "Sector": 2 }
            ];
        }
        return [
            { "metric": "PE", "Stock": summary.pe || 0, "Sector": 20, "Market": 15 },
            { "metric": "PB", "Stock": (summary.currentPrice / summary.bookValue) || 0, "Sector": 2.0, "Market": 2.5 },
            { "metric": "PEG", "Stock": 1.5, "Sector": 1.2, "Market": 1.0 }
        ];
    }

    // 19. Balance Sheet Allocation
    if (chartType.includes('Treemap')) {
        const last = balance[balance.length - 1] || {};
        return {
            name: "Balance Sheet",
            children: [
                { name: "Assets", children: [{ name: "Cash", loc: last.cash || 0 }, { name: "Inventory", loc: last.inventory || 0 }, { name: "Other", loc: (last.assets - (last.cash || 0) - (last.inventory || 0)) }] },
                { name: "Liabilities", children: [{ name: "Debt", loc: last.debt || 0 }, { name: "Other", loc: (last.liabilities - (last.debt || 0)) }] },
                { name: "Equity", children: [{ name: "Equity", loc: last.equity || 0 }] }
            ]
        };
    }

    // 21. Cash Flow Breakdown
    if (chartType.includes('Sankey')) {
        const last = income[income.length - 1] || {};
        return {
            nodes: [
                { id: "Revenue" },
                { id: "COGS" },
                { id: "Gross Profit" },
                { id: "OpEx" },
                { id: "Net Income" }
            ],
            links: [
                { source: "Revenue", target: "COGS", value: last.cogs || 1 },
                { source: "Revenue", target: "Gross Profit", value: last.gross_profit || 1 },
                { source: "Gross Profit", target: "OpEx", value: (last.sga || 0) + (last.rnd || 0) + 1 },
                { source: "Gross Profit", target: "Net Income", value: last.netProfit || 1 }
            ].map(l => ({ ...l, value: Math.max(1, l.value) })) // Ensure non-zero
        };
    }

    // 22. Global Revenue Map
    if (chartType.includes('Global') || chartType.includes('Choropleth')) {
        return []; // Not supported by yfinance free
    }

    // 23. Returns Heatmap
    if (chartType.includes('Heatmap') || chartType.includes('Calendar')) {
        if (realData.chartData) {
            // daily returns for last year
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            return realData.chartData
                .filter((d: any) => new Date(d.date) >= oneYearAgo)
                .map((d: any, i: number, arr: any[]) => {
                    const prev = i > 0 ? arr[i - 1] : d;
                    const change = prev.close > 0 ? ((d.close - prev.close) / prev.close) * 100 : 0;
                    return {
                        day: d.date,
                        value: change
                    };
                });
        }
    }

    // 24. Volatility Swarm
    if (chartType.includes('Swarm')) {
        if (realData.chartData) {
            return realData.chartData.slice(-100).map((d: any, i: number, arr: any[]) => {
                const prev = i > 0 ? arr[i - 1] : d;
                const change = prev.close > 0 ? ((d.close - prev.close) / prev.close) * 100 : 0;
                return {
                    id: d.date,
                    group: 'Price Change',
                    value: change,
                    volume: d.volume
                };
            });
        }
    }

    // 27. Analyst Prediction (Violin) -> Boxplot approximation
    if (chartType.includes('Prediction') || chartType.includes('Violin')) {
        // Not enough distribution data, maybe skip
        return [];
    }

    // 29. Dividend History
    if (chartType.includes('Dividend')) {
        return dividends.map((d: any) => ({
            id: d.date,
            dividend: d.dividend
        }));
    }

    // 30. Free Cash Flow Trend
    if (chartType.includes('Free Cash Flow')) {
        return cash.map((d: any) => ({
            dateStr: d.year,
            free_cash_flow: d.free_cash_flow
        }));
    }

    // 31. Debt vs Equity
    if (chartType.includes('Debt')) {
        return balance.map((d: any) => ({
            id: d.year,
            debt: d.debt,
            equity: d.equity
        }));
    }

    // 32. R&D Allocation
    if (chartType.includes('R&D')) {
        const last = income[income.length - 1] || {};
        return [
            { id: 'R&D', label: 'R&D', value: last.rnd || 0, color: 'hsl(120, 70%, 50%)' },
            { id: 'SG&A', label: 'SG&A', value: last.sga || 0, color: 'hsl(200, 70%, 50%)' },
            { id: 'Profit', label: 'Profit', value: last.operating_profit || 0, color: 'hsl(0, 70%, 50%)' }
        ].filter(d => d.value > 0);
    }

    // 34. Earnings Surprise
    if (chartType.includes('Surprise')) {
        return earnings.map((d: any) => ({
            id: d.date,
            actual_eps: d.actual_eps,
            estimated_eps: d.estimated_eps
        })).reverse();
    }

    // 36. Short Interest
    if (chartType.includes('Short')) {
        // Point in time data
        return [
            { dateStr: 'Current', short_interest_percent: (summary.sharesShort && summary.marketCap) ? (summary.sharesShort * summary.currentPrice / summary.marketCap) * 100 : 0 }
        ];
    }

    // 38. Institutional Holding
    if (chartType.includes('Institutional')) {
        return [
            { dateStr: 'Current', institutional_ownership: (summary.heldPercentInstitutions || 0) * 100 }
        ];
    }

    return [];
};
