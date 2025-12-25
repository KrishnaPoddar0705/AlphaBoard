import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Download, 
  FileText, 
  Lightbulb, 
  AlertTriangle, 
  TrendingUp, 
  BarChart3,
  Quote,
  Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ParsedData {
  title?: string;
  sector_outlook?: string;
  key_drivers?: string[];
  company_ratings?: Array<{ company: string; rating: string; rationale: string }>;
  valuation_summary?: string;
  risks?: string[];
  catalysts?: string[];
  charts_and_tables?: Array<{ description: string; page: number }>;
  price_forecasts?: Array<{ asset: string; forecast: string; timeframe: string }>;
  regulatory_changes?: string[];
  financial_tables?: Array<{ description: string; page: number; data: any }>;
  summary_sentence?: string;
  one_paragraph_thesis?: string;
  three_key_insights?: string[];
  three_risks?: string[];
  three_catalysts?: string[];
  three_actionables?: string[];
  citations?: Array<{ text: string; page: number; source?: string }>;
}

interface Report {
  id: string;
  title: string;
  sector?: string;
  tickers?: string[];
  created_at: string;
  original_filename: string;
  storage_path: string;
  upload_status: string;
  parsed?: ParsedData;
  analyst?: {
    username: string;
  };
}

export default function ReportDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'summary' | 'insights' | 'risks' | 'catalysts' | 'financials' | 'citations'>('summary');
  const [pdfUrl, setPdfUrl] = useState<string>('');

  useEffect(() => {
    if (id) {
      fetchReport();
    }
  }, [id]);

  const fetchReport = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('research_reports')
        .select(`
          *,
          analyst:analyst_id (
            username
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      // Transform to handle nested analyst object
      const transformedData = {
        ...data,
        analyst: Array.isArray(data.analyst) ? data.analyst[0] : data.analyst,
      };

      setReport(transformedData);

      // Get public URL for PDF
      if (data.storage_path) {
        const { data: urlData } = await supabase.storage
          .from('research-reports')
          .createSignedUrl(data.storage_path, 3600); // 1 hour expiry

        if (urlData) {
          setPdfUrl(urlData.signedUrl);
        }
      }
    } catch (err: any) {
      console.error('Error fetching report:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="glass p-12 rounded-xl border border-white/10 text-center">
        <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">Report not found</h3>
        <button
          onClick={() => navigate('/research')}
          className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
        >
          Back to Library
        </button>
      </div>
    );
  }

  const parsed = report.parsed || {};
  const isParsed = report.upload_status === 'parsed';

  const tabs = [
    { id: 'summary', label: 'Summary', icon: FileText },
    { id: 'insights', label: 'Insights', icon: Lightbulb },
    { id: 'risks', label: 'Risks', icon: AlertTriangle },
    { id: 'catalysts', label: 'Catalysts', icon: TrendingUp },
    { id: 'financials', label: 'Financials', icon: BarChart3 },
    { id: 'citations', label: 'Citations', icon: Quote },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <button
            onClick={() => navigate('/research')}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Library
          </button>
          <h1 className="text-3xl font-bold text-white mb-2">{report.title}</h1>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            {report.sector && <span>{report.sector}</span>}
            {report.tickers && report.tickers.length > 0 && (
              <span>{report.tickers.join(', ')}</span>
            )}
            <span>{new Date(report.created_at).toLocaleDateString()}</span>
            {report.analyst && <span>By {report.analyst.username}</span>}
          </div>
        </div>
        <button
          onClick={handleDownload}
          disabled={!pdfUrl}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Download PDF
        </button>
      </div>

      {/* Status Banner */}
      {!isParsed && (
        <div className="glass p-4 rounded-lg border border-yellow-500/20 bg-yellow-500/10">
          <p className="text-yellow-300 text-sm">
            Status: {report.upload_status} - Structured data will be available once parsing is complete.
          </p>
        </div>
      )}

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: PDF Viewer */}
        <div className="glass rounded-xl border border-white/10 overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <h3 className="text-white font-semibold">PDF Preview</h3>
          </div>
          <div className="aspect-[3/4] bg-black/20">
            {pdfUrl ? (
              <iframe
                src={pdfUrl}
                className="w-full h-full"
                title="PDF Preview"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-400">PDF not available</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Structured Data */}
        <div className="space-y-4">
          {/* Tabs */}
          <div className="glass rounded-xl border border-white/10 overflow-hidden">
            <div className="flex overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors border-b-2 flex items-center justify-center gap-2 whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-white bg-blue-500/10'
                        : 'border-transparent text-gray-400 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab Content */}
          <div className="glass p-6 rounded-xl border border-white/10 max-h-[600px] overflow-y-auto">
            {!isParsed ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-3" />
                <p className="text-gray-400">Parsing in progress...</p>
              </div>
            ) : (
              <>
                {/* Summary Tab */}
                {activeTab === 'summary' && (
                  <div className="space-y-4">
                    {parsed.summary_sentence && (
                      <div>
                        <h3 className="text-white font-semibold mb-2">Key Takeaway</h3>
                        <p className="text-gray-300">{parsed.summary_sentence}</p>
                      </div>
                    )}
                    {parsed.one_paragraph_thesis && (
                      <div>
                        <h3 className="text-white font-semibold mb-2">Investment Thesis</h3>
                        <p className="text-gray-300 whitespace-pre-wrap">{parsed.one_paragraph_thesis}</p>
                      </div>
                    )}
                    {parsed.sector_outlook && (
                      <div>
                        <h3 className="text-white font-semibold mb-2">Sector Outlook</h3>
                        <p className="text-gray-300">{parsed.sector_outlook}</p>
                      </div>
                    )}
                    {parsed.valuation_summary && (
                      <div>
                        <h3 className="text-white font-semibold mb-2">Valuation Summary</h3>
                        <p className="text-gray-300">{parsed.valuation_summary}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Insights Tab */}
                {activeTab === 'insights' && (
                  <div className="space-y-4">
                    {parsed.three_key_insights && parsed.three_key_insights.length > 0 && (
                      <div>
                        <h3 className="text-white font-semibold mb-3">Key Insights</h3>
                        <ul className="space-y-2">
                          {parsed.three_key_insights.map((insight, i) => (
                            <li key={i} className="flex gap-3">
                              <span className="text-blue-400 font-semibold">{i + 1}.</span>
                              <span className="text-gray-300">{insight}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {parsed.key_drivers && parsed.key_drivers.length > 0 && (
                      <div>
                        <h3 className="text-white font-semibold mb-3">Key Drivers</h3>
                        <ul className="space-y-2">
                          {parsed.key_drivers.map((driver, i) => (
                            <li key={i} className="flex gap-2 text-gray-300">
                              <span>•</span>
                              <span>{driver}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {parsed.three_actionables && parsed.three_actionables.length > 0 && (
                      <div>
                        <h3 className="text-white font-semibold mb-3">Actionables</h3>
                        <ul className="space-y-2">
                          {parsed.three_actionables.map((action, i) => (
                            <li key={i} className="flex gap-3">
                              <span className="text-green-400 font-semibold">{i + 1}.</span>
                              <span className="text-gray-300">{action}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Risks Tab */}
                {activeTab === 'risks' && (
                  <div className="space-y-4">
                    {parsed.three_risks && parsed.three_risks.length > 0 && (
                      <div>
                        <h3 className="text-white font-semibold mb-3">Top Risks</h3>
                        <ul className="space-y-3">
                          {parsed.three_risks.map((risk, i) => (
                            <li key={i} className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                              <div className="flex gap-3">
                                <span className="text-red-400 font-semibold">{i + 1}.</span>
                                <span className="text-gray-300">{risk}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {parsed.risks && parsed.risks.length > 0 && (
                      <div>
                        <h3 className="text-white font-semibold mb-3">All Risks</h3>
                        <ul className="space-y-2">
                          {parsed.risks.map((risk, i) => (
                            <li key={i} className="flex gap-2 text-gray-300">
                              <span>•</span>
                              <span>{risk}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Catalysts Tab */}
                {activeTab === 'catalysts' && (
                  <div className="space-y-4">
                    {parsed.three_catalysts && parsed.three_catalysts.length > 0 && (
                      <div>
                        <h3 className="text-white font-semibold mb-3">Top Catalysts</h3>
                        <ul className="space-y-3">
                          {parsed.three_catalysts.map((catalyst, i) => (
                            <li key={i} className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                              <div className="flex gap-3">
                                <span className="text-green-400 font-semibold">{i + 1}.</span>
                                <span className="text-gray-300">{catalyst}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {parsed.catalysts && parsed.catalysts.length > 0 && (
                      <div>
                        <h3 className="text-white font-semibold mb-3">All Catalysts</h3>
                        <ul className="space-y-2">
                          {parsed.catalysts.map((catalyst, i) => (
                            <li key={i} className="flex gap-2 text-gray-300">
                              <span>•</span>
                              <span>{catalyst}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {parsed.price_forecasts && parsed.price_forecasts.length > 0 && (
                      <div>
                        <h3 className="text-white font-semibold mb-3">Price Forecasts</h3>
                        <div className="space-y-2">
                          {parsed.price_forecasts.map((forecast, i) => (
                            <div key={i} className="p-3 bg-white/5 rounded-lg">
                              <div className="font-medium text-white">{forecast.asset}</div>
                              <div className="text-sm text-gray-400">
                                {forecast.forecast} • {forecast.timeframe}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Financials Tab */}
                {activeTab === 'financials' && (
                  <div className="space-y-4">
                    {parsed.financial_tables && parsed.financial_tables.length > 0 && (
                      <div>
                        <h3 className="text-white font-semibold mb-3">Financial Tables</h3>
                        <div className="space-y-3">
                          {parsed.financial_tables.map((table, i) => (
                            <div key={i} className="p-4 bg-white/5 border border-white/10 rounded-lg">
                              <div className="font-medium text-white mb-2">{table.description}</div>
                              <div className="text-sm text-gray-400">Page {table.page}</div>
                              {table.data && (
                                <div className="mt-2 text-sm text-gray-300">{JSON.stringify(table.data)}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {parsed.company_ratings && parsed.company_ratings.length > 0 && (
                      <div>
                        <h3 className="text-white font-semibold mb-3">Company Ratings</h3>
                        <div className="space-y-2">
                          {parsed.company_ratings.map((rating, i) => (
                            <div key={i} className="p-3 bg-white/5 rounded-lg">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-white">{rating.company}</span>
                                <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-sm">
                                  {rating.rating}
                                </span>
                              </div>
                              <p className="text-sm text-gray-400">{rating.rationale}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Citations Tab */}
                {activeTab === 'citations' && (
                  <div className="space-y-3">
                    {parsed.citations && parsed.citations.length > 0 ? (
                      parsed.citations.map((citation, i) => (
                        <div key={i} className="p-4 bg-white/5 border border-white/10 rounded-lg">
                          <p className="text-gray-300 italic mb-2">"{citation.text}"</p>
                          <div className="flex items-center gap-3 text-xs text-gray-400">
                            <span>Page {citation.page}</span>
                            {citation.source && <span>• {citation.source}</span>}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-400 text-center py-8">No citations available</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

