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
import { Card, CardContent, CardHeader } from '../components/ui/card-new';
import { Button } from '../components/ui/button';

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
        <Loader2 className="w-8 h-8 text-[#1D4ED8] animate-spin" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-5 md:p-7">
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <FileText className="w-12 h-12 text-[#8B857A] mx-auto" />
            <h3 className="text-xl font-semibold text-[#1C1B17]">Report not found</h3>
            <Button
              onClick={() => navigate('/research')}
              variant="outline"
            >
              Back to Library
            </Button>
          </CardContent>
        </Card>
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
    <div className="p-5 md:p-7 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex-1 min-w-0">
          <Button
            variant="ghost"
            onClick={() => navigate('/research')}
            className="flex items-center gap-2 text-[#6F6A60] hover:text-[#1C1B17] mb-4 p-0 h-auto"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Library
          </Button>
          <h1 className="text-[28px] font-bold text-[#1C1B17] tracking-tight mb-2 break-words">{report.title}</h1>
          <div className="flex flex-wrap items-center gap-3 md:gap-4 text-sm text-[#6F6A60]">
            {report.sector && <span>{report.sector}</span>}
            {report.tickers && report.tickers.length > 0 && (
              <span className="flex flex-wrap gap-1">
                {report.tickers.map((ticker, i) => (
                  <span key={i} className="px-2 py-0.5 bg-[#FBF7ED] border border-[#D7D0C2] rounded text-xs font-medium">
                    {ticker}
                  </span>
                ))}
              </span>
            )}
            <span>{new Date(report.created_at).toLocaleDateString()}</span>
            {report.analyst && <span>By {report.analyst.username}</span>}
          </div>
        </div>
        <Button
          onClick={handleDownload}
          disabled={!pdfUrl}
          className="flex items-center gap-2 flex-shrink-0"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Download PDF</span>
          <span className="sm:hidden">Download</span>
        </Button>
      </div>

      {/* Status Banner */}
      {!isParsed && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <p className="text-yellow-800 text-sm font-medium">
              Status: {report.upload_status} - Structured data will be available once parsing is complete.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
        {/* Left: PDF Viewer */}
        <Card className="overflow-hidden">
          <CardHeader className="p-4 border-b border-[#D7D0C2]">
            <h3 className="text-[#1C1B17] font-semibold text-sm md:text-base">PDF Preview</h3>
          </CardHeader>
          <div className="aspect-[3/4] bg-[#FBF7ED]">
            {pdfUrl ? (
              <iframe
                src={pdfUrl}
                className="w-full h-full"
                title="PDF Preview"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-[#6F6A60]">PDF not available</p>
              </div>
            )}
          </div>
        </Card>

        {/* Right: Structured Data */}
        <div className="space-y-4">
          {/* Tabs */}
          <Card className="overflow-hidden">
            <div className="flex overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm font-medium transition-colors border-b-2 flex items-center justify-center gap-1.5 md:gap-2 whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'border-[#1D4ED8] text-[#1C1B17] bg-[#1D4ED8]/10'
                        : 'border-transparent text-[#6F6A60] hover:text-[#1C1B17] hover:bg-[#FBF7ED]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.label.slice(0, 3)}</span>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Tab Content */}
          <Card>
            <CardContent className="p-4 md:p-6 max-h-[600px] overflow-y-auto">
              {!isParsed ? (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 text-[#1D4ED8] animate-spin mx-auto mb-3" />
                  <p className="text-[#6F6A60]">Parsing in progress...</p>
                </div>
              ) : (
              <>
                {/* Summary Tab */}
                {activeTab === 'summary' && (
                  <div className="space-y-5">
                    {parsed.summary_sentence && (
                      <div>
                        <h3 className="text-[#1C1B17] font-semibold mb-2 text-sm md:text-base">Key Takeaway</h3>
                        <p className="text-[#6F6A60] text-sm md:text-base leading-relaxed">{parsed.summary_sentence}</p>
                      </div>
                    )}
                    {parsed.one_paragraph_thesis && (
                      <div>
                        <h3 className="text-[#1C1B17] font-semibold mb-2 text-sm md:text-base">Investment Thesis</h3>
                        <p className="text-[#6F6A60] whitespace-pre-wrap text-sm md:text-base leading-relaxed">{parsed.one_paragraph_thesis}</p>
                      </div>
                    )}
                    {parsed.sector_outlook && (
                      <div>
                        <h3 className="text-[#1C1B17] font-semibold mb-2 text-sm md:text-base">Sector Outlook</h3>
                        <p className="text-[#6F6A60] text-sm md:text-base leading-relaxed">{parsed.sector_outlook}</p>
                      </div>
                    )}
                    {parsed.valuation_summary && (
                      <div>
                        <h3 className="text-[#1C1B17] font-semibold mb-2 text-sm md:text-base">Valuation Summary</h3>
                        <p className="text-[#6F6A60] text-sm md:text-base leading-relaxed">{parsed.valuation_summary}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Insights Tab */}
                {activeTab === 'insights' && (
                  <div className="space-y-5">
                    {parsed.three_key_insights && parsed.three_key_insights.length > 0 && (
                      <div>
                        <h3 className="text-[#1C1B17] font-semibold mb-3 text-sm md:text-base">Key Insights</h3>
                        <ul className="space-y-2.5">
                          {parsed.three_key_insights.map((insight, i) => (
                            <li key={i} className="flex gap-3">
                              <span className="text-[#1D4ED8] font-semibold flex-shrink-0">{i + 1}.</span>
                              <span className="text-[#6F6A60] text-sm md:text-base">{insight}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {parsed.key_drivers && parsed.key_drivers.length > 0 && (
                      <div>
                        <h3 className="text-[#1C1B17] font-semibold mb-3 text-sm md:text-base">Key Drivers</h3>
                        <ul className="space-y-2">
                          {parsed.key_drivers.map((driver, i) => (
                            <li key={i} className="flex gap-2 text-[#6F6A60] text-sm md:text-base">
                              <span className="text-[#1D4ED8]">•</span>
                              <span>{driver}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {parsed.three_actionables && parsed.three_actionables.length > 0 && (
                      <div>
                        <h3 className="text-[#1C1B17] font-semibold mb-3 text-sm md:text-base">Actionables</h3>
                        <ul className="space-y-2.5">
                          {parsed.three_actionables.map((action, i) => (
                            <li key={i} className="flex gap-3">
                              <span className="text-[#2F8F5B] font-semibold flex-shrink-0">{i + 1}.</span>
                              <span className="text-[#6F6A60] text-sm md:text-base">{action}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Risks Tab */}
                {activeTab === 'risks' && (
                  <div className="space-y-5">
                    {parsed.three_risks && parsed.three_risks.length > 0 && (
                      <div>
                        <h3 className="text-[#1C1B17] font-semibold mb-3 text-sm md:text-base">Top Risks</h3>
                        <ul className="space-y-3">
                          {parsed.three_risks.map((risk, i) => (
                            <li key={i} className="p-3 bg-[#B23B2A]/10 border border-[#B23B2A]/20 rounded-lg">
                              <div className="flex gap-3">
                                <span className="text-[#B23B2A] font-semibold flex-shrink-0">{i + 1}.</span>
                                <span className="text-[#6F6A60] text-sm md:text-base">{risk}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {parsed.risks && parsed.risks.length > 0 && (
                      <div>
                        <h3 className="text-[#1C1B17] font-semibold mb-3 text-sm md:text-base">All Risks</h3>
                        <ul className="space-y-2">
                          {parsed.risks.map((risk, i) => (
                            <li key={i} className="flex gap-2 text-[#6F6A60] text-sm md:text-base">
                              <span className="text-[#B23B2A]">•</span>
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
                  <div className="space-y-5">
                    {parsed.three_catalysts && parsed.three_catalysts.length > 0 && (
                      <div>
                        <h3 className="text-[#1C1B17] font-semibold mb-3 text-sm md:text-base">Top Catalysts</h3>
                        <ul className="space-y-3">
                          {parsed.three_catalysts.map((catalyst, i) => (
                            <li key={i} className="p-3 bg-[#2F8F5B]/10 border border-[#2F8F5B]/20 rounded-lg">
                              <div className="flex gap-3">
                                <span className="text-[#2F8F5B] font-semibold flex-shrink-0">{i + 1}.</span>
                                <span className="text-[#6F6A60] text-sm md:text-base">{catalyst}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {parsed.catalysts && parsed.catalysts.length > 0 && (
                      <div>
                        <h3 className="text-[#1C1B17] font-semibold mb-3 text-sm md:text-base">All Catalysts</h3>
                        <ul className="space-y-2">
                          {parsed.catalysts.map((catalyst, i) => (
                            <li key={i} className="flex gap-2 text-[#6F6A60] text-sm md:text-base">
                              <span className="text-[#2F8F5B]">•</span>
                              <span>{catalyst}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {parsed.price_forecasts && parsed.price_forecasts.length > 0 && (
                      <div>
                        <h3 className="text-[#1C1B17] font-semibold mb-3 text-sm md:text-base">Price Forecasts</h3>
                        <div className="space-y-2">
                          {parsed.price_forecasts.map((forecast, i) => (
                            <div key={i} className="p-3 bg-[#FBF7ED] border border-[#D7D0C2] rounded-lg">
                              <div className="font-medium text-[#1C1B17] text-sm md:text-base">{forecast.asset}</div>
                              <div className="text-xs md:text-sm text-[#6F6A60] mt-1">
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
                  <div className="space-y-5">
                    {parsed.financial_tables && parsed.financial_tables.length > 0 && (
                      <div>
                        <h3 className="text-[#1C1B17] font-semibold mb-3 text-sm md:text-base">Financial Tables</h3>
                        <div className="space-y-3">
                          {parsed.financial_tables.map((table, i) => (
                            <div key={i} className="p-4 bg-[#FBF7ED] border border-[#D7D0C2] rounded-lg">
                              <div className="font-medium text-[#1C1B17] mb-2 text-sm md:text-base">{table.description}</div>
                              <div className="text-xs md:text-sm text-[#6F6A60]">Page {table.page}</div>
                              {table.data && (
                                <div className="mt-2 text-xs md:text-sm text-[#6F6A60] font-mono break-all">{JSON.stringify(table.data, null, 2)}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {parsed.company_ratings && parsed.company_ratings.length > 0 && (
                      <div>
                        <h3 className="text-[#1C1B17] font-semibold mb-3 text-sm md:text-base">Company Ratings</h3>
                        <div className="space-y-2">
                          {parsed.company_ratings.map((rating, i) => (
                            <div key={i} className="p-3 bg-[#FBF7ED] border border-[#D7D0C2] rounded-lg">
                              <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                                <span className="font-medium text-[#1C1B17] text-sm md:text-base">{rating.company}</span>
                                <span className="px-2 py-1 bg-[#1D4ED8]/10 text-[#1D4ED8] rounded text-xs md:text-sm font-medium border border-[#1D4ED8]/20">
                                  {rating.rating}
                                </span>
                              </div>
                              <p className="text-xs md:text-sm text-[#6F6A60] mt-1">{rating.rationale}</p>
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
                        <div key={i} className="p-4 bg-[#FBF7ED] border border-[#D7D0C2] rounded-lg">
                          <p className="text-[#6F6A60] italic mb-2 text-sm md:text-base">"{citation.text}"</p>
                          <div className="flex items-center gap-3 text-xs md:text-sm text-[#6F6A60] flex-wrap">
                            <span>Page {citation.page}</span>
                            {citation.source && <span>• {citation.source}</span>}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-[#6F6A60] text-center py-8">No citations available</p>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}

