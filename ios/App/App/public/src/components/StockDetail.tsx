import { useEffect, useState } from 'react';
import { X, BarChart2, FileText, DollarSign, PieChart, Loader, Maximize2, Minimize2, Newspaper } from 'lucide-react';
import { 
    getStockSummary, 
    getStockHistory, 
    getIncomeStatement, 
    getBalanceSheet, 
    getCashFlow, 
    getQuarterly,
    getDividends,
    getEarnings,
    getStockNews
} from '../lib/api';
import ChartRenderer from './charts/ChartRenderer';
import chartConfig from '../data/charts.json';
import NewsCard from './NewsCard';

interface StockDetailProps {
  stock: any;
  onClose: () => void;
}

export default function StockDetail({ stock, onClose }: StockDetailProps) {
  const [activeTab, setActiveTab] = useState('chart');
  const [activeChartCategory, setActiveChartCategory] = useState('technical'); // technical | fundamental
  const [activeChartId, setActiveChartId] = useState(1);
  
  // Consolidated Data State
  const [data, setData] = useState<any>({
      financials: {},
      chartData: [],
      incomeStatement: [],
      balanceSheet: [],
      cashFlow: [],
      quarterly: [],
      dividends: [],
      earnings: [],
      news: []
  });

  const [loading, setLoading] = useState(true);
  const [financialsLoading, setFinancialsLoading] = useState(false);
  const [newsLoading, setNewsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTechnicalType, setActiveTechnicalType] = useState<'line' | 'candlestick'>('line');
  
  // Custom Returns State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customReturn, setCustomReturn] = useState<number | null>(null);

  useEffect(() => {
      fetchData();
  }, [stock.ticker]);

  // Fetch news when News tab is activated
  useEffect(() => {
      if (activeTab === 'news' && data.news.length === 0 && !newsLoading) {
          fetchNews();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Calculate custom returns when dates change
  useEffect(() => {
      if (startDate && endDate && data?.chartData?.length > 0) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          
          // Find closest data points
          const sortedData = [...data.chartData].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
          
          let startPrice = null;
          let endPrice = null;

          // Simple find or closest logic
          for (const point of sortedData) {
              const d = new Date(point.date);
              if (!startPrice && d >= start) startPrice = point.close;
              if (d <= end) endPrice = point.close;
          }

          if (startPrice && endPrice) {
              const ret = ((endPrice - startPrice) / startPrice) * 100;
              setCustomReturn(ret);
          } else {
              setCustomReturn(null);
          }
      }
  }, [startDate, endDate, data.chartData]);

  const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      // 1. Initial Load: Summary & Price History (Critical for basic view)
      try {
          const [summary, history] = await Promise.all([
              getStockSummary(stock.ticker),
              getStockHistory(stock.ticker)
          ]);

          setData((prev: any) => ({
              ...prev,
              financials: summary || {},
              chartData: history || []
          }));
          
          // Stop main loading spinner here so user sees something
          setLoading(false);

          // 2. Background Load: Heavy Financials
          fetchFinancials();

      } catch (err) {
          console.error("Failed to fetch basic details", err);
          setError("Failed to load stock data. Please try again.");
          setLoading(false);
      }
  };

  const fetchFinancials = async () => {
      setFinancialsLoading(true);
      try {
          // Fetch these in parallel but independently so one failure doesn't kill others
          const promises = [
              getIncomeStatement(stock.ticker).then(d => setData((prev: any) => ({ ...prev, incomeStatement: d }))),
              getBalanceSheet(stock.ticker).then(d => setData((prev: any) => ({ ...prev, balanceSheet: d }))),
              getCashFlow(stock.ticker).then(d => setData((prev: any) => ({ ...prev, cashFlow: d }))),
              getQuarterly(stock.ticker).then(d => setData((prev: any) => ({ ...prev, quarterly: d }))),
              getDividends(stock.ticker).then(d => setData((prev: any) => ({ ...prev, dividends: d }))),
              getEarnings(stock.ticker).then(d => setData((prev: any) => ({ ...prev, earnings: d })))
          ];
          
          await Promise.allSettled(promises);
      } catch (e) {
          console.error("Background fetch error", e);
      } finally {
          setFinancialsLoading(false);
      }
  };

  const fetchNews = async () => {
      setNewsLoading(true);
      setError(null);
      try {
          const newsData = await getStockNews(stock.ticker);
          setData((prev: any) => ({ ...prev, news: newsData.articles || newsData || [] }));
      } catch (e: any) {
          console.error("Error fetching news", e);
          setError("Failed to load news. Please try again.");
          // Set empty array so UI shows empty state instead of crashing
          setData((prev: any) => ({ ...prev, news: [] }));
      } finally {
          setNewsLoading(false);
      }
  };

  const toggleExpand = () => {
      setIsExpanded(!isExpanded);
  };

  if (loading) {
      return (
        <div className="h-full flex items-center justify-center bg-[#1e293b] border-l border-white/10">
            <div className="text-center">
                <Loader className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-2" />
                <p className="text-gray-400">Loading {stock.ticker}...</p>
            </div>
        </div>
      );
  }

  // Ensure data exists
  const financials = data?.financials || {};

  // Filter charts for fundamental view (everything except ID 1, 2, 3, 6, 7, 8, 9 which are technical/financial)
  // Or simpler: if library is nivo -> fundamental, highcharts/stockcharts -> technical
  const fundamentalCharts = chartConfig.charts.filter(c => c.library.startsWith('nivo'));

  return (
    <div className={`h-full flex flex-col bg-[#1e293b] shadow-2xl overflow-hidden transition-all duration-300 ${isExpanded ? 'fixed inset-0 z-50 w-screen' : 'border-l border-white/10'}`}>
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#0f172a]">
        <div className="flex items-center gap-4">
            <div>
                <h2 className="text-2xl font-bold text-white">{stock.ticker}</h2>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className={`text-lg font-mono font-bold ${stock.current_price >= stock.entry_price ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ₹{financials.currentPrice?.toLocaleString() || stock.current_price?.toFixed(2)}
                    </span>
                    <span className="text-xs text-gray-400">Entry: ₹{stock.entry_price?.toFixed(2)}</span>
                    {stock.exit_price && (
                        <>
                            <span className="text-xs text-gray-400">Exit: ₹{stock.exit_price.toFixed(2)}</span>
                            {stock.exit_date && (
                                <span className="text-xs text-gray-400">
                                    Exit Date: {new Date(stock.exit_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                            )}
                        </>
                    )}
                </div>
            </div>
            {/* Toggle Expand Button */}
            <button onClick={toggleExpand} className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white hidden md:block" title={isExpanded ? "Collapse" : "Expand"}>
                {isExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white">
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Thesis Section */}
      {!isExpanded && (
        <div className="p-4 bg-[#1e293b] border-b border-white/10 space-y-4">
            <div>
                <h3 className="text-xs font-medium text-blue-200 uppercase tracking-wider mb-1">Investment Thesis</h3>
                <p className="text-gray-300 text-sm italic leading-relaxed whitespace-pre-wrap">
                "{stock.thesis || "No thesis provided for this recommendation."}"
                </p>
                
                {stock.images && stock.images.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {stock.images.map((img: string, idx: number) => (
                            <a key={idx} href={img} target="_blank" rel="noopener noreferrer" className="block aspect-video rounded-lg overflow-hidden border border-white/10 hover:border-indigo-500 transition-all">
                                <img src={img} alt={`Thesis attachment ${idx + 1}`} className="w-full h-full object-cover" />
                            </a>
                        ))}
                    </div>
                )}
            </div>
            
            {/* Custom Return Calculator */}
            <div className="flex items-end gap-4 bg-white/5 p-3 rounded-lg border border-white/5">
                <div>
                    <label className="block text-xs text-gray-400 mb-1">Start Date</label>
                    <input 
                        type="date" 
                        className="bg-[#0f172a] border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-xs text-gray-400 mb-1">End Date</label>
                    <input 
                        type="date" 
                        className="bg-[#0f172a] border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                    />
                </div>
                <div className="flex flex-col justify-end">
                    <span className="text-xs text-gray-400 mb-1">Return</span>
                    <span className={`text-sm font-bold font-mono ${customReturn !== null ? (customReturn >= 0 ? 'text-emerald-400' : 'text-rose-400') : 'text-gray-500'}`}>
                        {customReturn !== null ? `${customReturn > 0 ? '+' : ''}${customReturn.toFixed(2)}%` : '--'}
                    </span>
                </div>
            </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-white/10 bg-[#0f172a] overflow-x-auto">
        <button
          onClick={() => setActiveTab('chart')}
          className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 min-w-[100px]
            ${activeTab === 'chart' ? 'border-indigo-500 text-indigo-400 bg-white/5' : 'border-transparent text-gray-400 hover:text-white hover:bg-white/5'}`}
        >
          <BarChart2 className="w-4 h-4" /> <span>Charts</span>
        </button>
        <button
          onClick={() => setActiveTab('financials')}
          className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 min-w-[100px]
            ${activeTab === 'financials' ? 'border-indigo-500 text-indigo-400 bg-white/5' : 'border-transparent text-gray-400 hover:text-white hover:bg-white/5'}`}
        >
          <FileText className="w-4 h-4" /> <span>Summary</span>
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 min-w-[100px]
            ${activeTab === 'reports' ? 'border-indigo-500 text-indigo-400 bg-white/5' : 'border-transparent text-gray-400 hover:text-white hover:bg-white/5'}`}
        >
          <DollarSign className="w-4 h-4" /> <span>$ Financials</span>
        </button>
        <button
          onClick={() => setActiveTab('news')}
          className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 min-w-[100px]
            ${activeTab === 'news' ? 'border-indigo-500 text-indigo-400 bg-white/5' : 'border-transparent text-gray-400 hover:text-white hover:bg-white/5'}`}
        >
          <Newspaper className="w-4 h-4" /> <span>News</span>
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-0 bg-[#0f172a] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent relative">
        
        {/* Loading Indicator for Background Data */}
        {financialsLoading && (
            <div className="absolute top-2 right-2 z-10 bg-black/50 px-2 py-1 rounded text-xs text-white flex items-center gap-2">
                <Loader className="w-3 h-3 animate-spin" /> Fetching details...
            </div>
        )}

        {activeTab === 'chart' && (
          <div className="flex flex-col h-full">
             {/* Sub-nav for chart type */}
             <div className="flex items-center border-b border-white/10 bg-[#1e293b] px-4 py-2 gap-4">
                 <div className="flex bg-[#0f172a] rounded-lg p-0.5 border border-white/10">
                    <button 
                        onClick={() => { setActiveChartCategory('technical'); setActiveChartId(1); }}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeChartCategory === 'technical' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        Technical
                    </button>
                    <button 
                        onClick={() => setActiveChartCategory('fundamental')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeChartCategory === 'fundamental' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        Fundamental
                    </button>
                 </div>

                 {activeChartCategory === 'technical' && (
                     <div className="flex bg-[#0f172a] rounded-lg p-0.5 border border-white/10 ml-2">
                        <button 
                            onClick={() => setActiveTechnicalType('line')}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeTechnicalType === 'line' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            Line
                        </button>
                        <button 
                            onClick={() => setActiveTechnicalType('candlestick')}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeTechnicalType === 'candlestick' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            Candles
                        </button>
                     </div>
                 )}
                 
                 {activeChartCategory === 'fundamental' && (
                     <select 
                        value={activeChartId}
                        onChange={(e) => setActiveChartId(Number(e.target.value))}
                        className="bg-[#0f172a] border border-white/10 rounded text-xs text-white p-1 focus:outline-none ml-auto"
                    >
                        {fundamentalCharts.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.chartType}
                            </option>
                        ))}
                    </select>
                 )}
             </div>

             {/* Chart Canvas */}
             <div className="flex-1 w-full relative">
                 {activeChartCategory === 'technical' ? (
                     /* Render Technical Chart (Highcharts Stock) with built-in tools */
                     <ChartRenderer 
                        chartId={1} 
                        stockTicker={stock.ticker} 
                        height={isExpanded ? '100%' : 500} 
                        technicalType={activeTechnicalType} 
                        externalData={data}
                        customDateRange={startDate && endDate ? { start: startDate, end: endDate } : undefined}
                     />
                 ) : (
                     /* Render Nivo Charts */
                     <div className="p-4 h-full">
                        <div className="h-full w-full bg-[#1e293b] rounded-lg border border-white/5 p-4">
                             <ChartRenderer 
                                chartId={activeChartId} 
                                stockTicker={stock.ticker} 
                                height={isExpanded ? '100%' : 500} 
                                externalData={data}
                             />
                        </div>
                     </div>
                 )}
             </div>
          </div>
        )}

        {activeTab === 'news' && (
            <div className="p-6 max-w-4xl mx-auto">
                {newsLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="text-center">
                            <Loader className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-2" />
                            <p className="text-gray-400">Loading news for {stock.ticker}...</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="text-center py-12">
                        <Newspaper className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                        <p className="text-red-400 mb-2">{error}</p>
                        <button 
                            onClick={fetchNews}
                            className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                        >
                            Retry
                        </button>
                    </div>
                ) : data.news && data.news.length > 0 ? (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-white">Latest News</h3>
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-gray-400">{data.news.length} articles</span>
                                <button 
                                    onClick={fetchNews}
                                    className="px-3 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors"
                                    disabled={newsLoading}
                                >
                                    Refresh
                                </button>
                            </div>
                        </div>
                        {data.news.map((article: any) => (
                            <NewsCard key={article.id || article.headline} article={article} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <Newspaper className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-400 mb-2">No news articles available for {stock.ticker}</p>
                        <p className="text-xs text-gray-500 mb-4">News will be fetched from multiple sources and summarized with AI.</p>
                        <button 
                            onClick={fetchNews}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                            disabled={newsLoading}
                        >
                            {newsLoading ? 'Loading...' : 'Load News'}
                        </button>
                    </div>
                )}
            </div>
        )}

        {(activeTab === 'financials' || activeTab === 'reports') && (
            <div className="p-6 max-w-4xl mx-auto">
                 {activeTab === 'financials' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white/5 p-4 rounded-lg">
                                <div className="text-gray-400 text-xs uppercase">Market Cap</div>
                                <div className="text-white font-bold text-lg truncate">
                                    {financials.marketCap ? `₹ ${(financials.marketCap / 10000000).toFixed(2)} Cr` : 'N/A'}
                                </div>
                            </div>
                            <div className="bg-white/5 p-4 rounded-lg">
                                <div className="text-gray-400 text-xs uppercase">Stock P/E</div>
                                <div className="text-white font-bold text-lg">{financials.pe?.toFixed(2) || 'N/A'}</div>
                            </div>
                            <div className="bg-white/5 p-4 rounded-lg">
                                <div className="text-gray-400 text-xs uppercase">ROCE</div>
                                <div className="text-white font-bold text-lg">{financials.roce ? `${(financials.roce * 100).toFixed(2)}%` : 'N/A'}</div>
                            </div>
                            <div className="bg-white/5 p-4 rounded-lg">
                                <div className="text-gray-400 text-xs uppercase">ROE</div>
                                <div className="text-white font-bold text-lg">{financials.roe ? `${(financials.roe * 100).toFixed(2)}%` : 'N/A'}</div>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-white font-bold mb-3 flex items-center gap-2">
                                <PieChart className="w-4 h-4 text-indigo-400" /> Quarterly Trend
                            </h4>
                            {data?.quarterly && data.quarterly.length > 0 ? (
                                <div className="bg-white/5 rounded-lg overflow-hidden">
                                    <table className="min-w-full divide-y divide-white/10 text-sm">
                                        <thead className="bg-white/10">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-gray-400">Period</th>
                                                <th className="px-4 py-2 text-right text-gray-400">Rev</th>
                                                <th className="px-4 py-2 text-right text-gray-400">Profit</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/10">
                                            {data.quarterly.map((q: any, i: number) => (
                                                <tr key={i}>
                                                    <td className="px-4 py-2 text-gray-300">{q.year}</td>
                                                    <td className="px-4 py-2 text-right text-white">{(q.revenue / 10000000).toFixed(0)}Cr</td>
                                                    <td className="px-4 py-2 text-right text-emerald-400">{(q.profit / 10000000).toFixed(0)}Cr</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : <div className="text-gray-500 italic">No quarterly data available (Loading...)</div>}
                        </div>
                    </div>
                 )}

                 {activeTab === 'reports' && (
                    <div className="space-y-8">
                        {/* Income Statement */}
                        <div>
                            <h4 className="text-lg font-bold text-white mb-4 border-b border-white/10 pb-2">Income Statement (Annual)</h4>
                            {data?.incomeStatement && data.incomeStatement.length > 0 ? (
                                <div className="bg-white/5 rounded-lg overflow-x-auto">
                                    <table className="min-w-full divide-y divide-white/10 text-sm text-left">
                                        <thead className="bg-white/10">
                                            <tr>
                                                <th className="px-4 py-2 text-gray-400">Year</th>
                                                <th className="px-4 py-2 text-right text-gray-400">Revenue</th>
                                                <th className="px-4 py-2 text-right text-gray-400">Net Profit</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/10">
                                            {data.incomeStatement.map((item: any, i: number) => (
                                                <tr key={i}>
                                                    <td className="px-4 py-2 text-gray-300">{item.year}</td>
                                                    <td className="px-4 py-2 text-right text-white">₹{(item.revenue / 10000000).toFixed(0)}Cr</td>
                                                    <td className="px-4 py-2 text-right text-emerald-400">₹{(item.netProfit / 10000000).toFixed(0)}Cr</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : <div className="text-gray-500">Data unavailable</div>}
                        </div>

                        {/* Balance Sheet */}
                        <div>
                            <h4 className="text-lg font-bold text-white mb-4 border-b border-white/10 pb-2">Balance Sheet</h4>
                            {data?.balanceSheet && data.balanceSheet.length > 0 ? (
                                <div className="bg-white/5 rounded-lg overflow-x-auto">
                                    <table className="min-w-full divide-y divide-white/10 text-sm text-left">
                                        <thead className="bg-white/10">
                                            <tr>
                                                <th className="px-4 py-2 text-gray-400">Year</th>
                                                <th className="px-4 py-2 text-right text-gray-400">Total Assets</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/10">
                                            {data.balanceSheet.map((b: any, i: number) => (
                                                <tr key={i}>
                                                    <td className="px-4 py-2 text-gray-300">{b.year}</td>
                                                    <td className="px-4 py-2 text-right text-white font-mono">₹{(b.assets / 10000000).toFixed(0)}Cr</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : <div className="text-gray-500">Data unavailable</div>}
                        </div>

                        {/* Cash Flow */}
                        <div>
                            <h4 className="text-lg font-bold text-white mb-4 border-b border-white/10 pb-2">Cash Flow</h4>
                            {data?.cashFlow && data.cashFlow.length > 0 ? (
                                <div className="bg-white/5 rounded-lg overflow-x-auto">
                                    <table className="min-w-full divide-y divide-white/10 text-sm text-left">
                                        <thead className="bg-white/10">
                                            <tr>
                                                <th className="px-4 py-2 text-gray-400">Year</th>
                                                <th className="px-4 py-2 text-right text-gray-400">Operating CF</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/10">
                                            {data.cashFlow.map((c: any, i: number) => (
                                                <tr key={i}>
                                                    <td className="px-4 py-2 text-gray-300">{c.year}</td>
                                                    <td className={`px-4 py-2 text-right font-mono ${c.operating > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        ₹{(c.operating / 10000000).toFixed(0)}Cr
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : <div className="text-gray-500">Data unavailable</div>}
                        </div>
                    </div>
                 )}
            </div>
        )}

      </div>
    </div>
  );
}
