import { useState } from 'react';
import { Search, Loader2, FileText, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import MarkdownAnswer from './MarkdownAnswer';
import GraphRenderer from './GraphRenderer';
import { Card, CardContent } from '../ui/card-new';
import { Button } from '../ui/button';

interface Citation {
  excerpt: string;
  page?: number;
  source?: string;
  report_id?: string;
  title?: string;
}

interface RelevantReport {
  id: string;
  title: string;
  sector?: string;
  tickers?: string[];
  created_at: string;
}

interface GraphData {
  type: 'line' | 'bar' | 'pie' | 'area';
  title: string;
  xAxis?: string;
  yAxis?: string;
  data?: Array<{
    [key: string]: string | number;
  }>;
  series?: Array<{
    name: string;
    data: number[];
  }>;
}

interface SearchResult {
  answer: string;
  citations: Citation[];
  relevant_reports: RelevantReport[];
  graphs?: GraphData[];
  query_time_ms: number;
  total_reports_searched: number;
}

const EXAMPLE_QUERIES = [
  'What are the key risks across all metals reports?',
  'Summarize the EPS growth outlook for IT Services sector',
  'What regulatory changes are mentioned in recent reports?',
  'Compare valuation multiples across healthcare companies',
];

export default function RAGSearchBar() {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleCitationClick = (reportId: string) => {
    navigate(`/research/${reportId}`);
  };

  const handleSearch = async () => {
    if (!query.trim()) return;

    setSearching(true);
    setError('');
    setResult(null);

    try {
      // Get Supabase session (synced from Clerk authentication)
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
      const searchUrl = `${supabaseUrl}/functions/v1/query-research-rag`;

      const response = await fetch(searchUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          filters: {},
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Search failed');
      }

      const data = await response.json();
      setResult(data);

    } catch (err: any) {
      const { getUserFriendlyError } = await import('../../lib/errorSanitizer');
      setError(getUserFriendlyError(err));
    } finally {
      setSearching(false);
    }
  };

  const handleExampleQuery = (exampleQuery: string) => {
    setQuery(exampleQuery);
    setResult(null);
    setError('');
  };

  return (
    <div className="space-y-5">
      {/* Search Input */}
      <Card>
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-[#6F6A60]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Ask a question about your research reports..."
                disabled={searching}
                className="w-full bg-[#FBF7ED] border border-[#D7D0C2] rounded-lg pl-9 md:pl-12 pr-4 py-2.5 md:py-3 text-[#1C1B17] placeholder-[#8B857A] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8] disabled:opacity-50 transition-all text-sm md:text-base"
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={!query.trim() || searching}
              className="flex items-center gap-2 whitespace-nowrap"
            >
              {searching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">Searching...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span className="hidden sm:inline">Q Search</span>
                  <span className="sm:hidden">Search</span>
                </>
              )}
            </Button>
          </div>

          {/* Example Queries */}
          {!result && !searching && (
            <div className="mt-4">
              <p className="text-sm text-[#6F6A60] mb-2 font-medium">Try asking:</p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_QUERIES.map((example, index) => (
                  <button
                    key={index}
                    onClick={() => handleExampleQuery(example)}
                    className="text-xs px-3 py-1.5 bg-[#FBF7ED] hover:bg-[#F7F2E6] border border-[#D7D0C2] rounded-full text-[#1C1B17] transition-colors font-medium"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-[#B23B2A]/30 bg-[#B23B2A]/5">
          <CardContent className="p-4">
            <p className="text-[#B23B2A] text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-5">
          {/* Answer */}
          <Card>
            <CardContent className="p-4 md:p-6">
              <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
                <h3 className="text-lg font-semibold text-[#1C1B17]">Answer</h3>
                <span className="text-xs md:text-sm text-[#6F6A60] font-mono">
                  {result.total_reports_searched} reports searched in {result.query_time_ms}ms
                </span>
              </div>
              <div className="markdown-wrapper">
                <MarkdownAnswer 
                  content={result.answer} 
                  citations={result.citations}
                  onCitationClick={handleCitationClick}
                />
              </div>
            </CardContent>
          </Card>

          {/* Graphs */}
          {result.graphs && result.graphs.length > 0 && (
            <div className="space-y-4">
              {result.graphs.map((graph, index) => (
                <GraphRenderer key={index} graph={graph} />
              ))}
            </div>
          )}

          {/* Citations */}
          {result.citations && result.citations.length > 0 && (
            <Card>
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
                  <h3 className="text-lg font-semibold text-[#1C1B17]">
                    References
                  </h3>
                  <span className="text-xs md:text-sm text-[#6F6A60]">
                    {result.citations.length} citation{result.citations.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="space-y-3">
                  {result.citations.map((citation, index) => {
                    const citationNumber = index + 1;
                    return (
                      <div
                        key={index}
                        id={`citation-ref-${citationNumber}`}
                        className="bg-[#FBF7ED] border border-[#D7D0C2] rounded-lg p-4 hover:border-[#1D4ED8]/30 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          {/* Citation Number */}
                          <div className="flex-shrink-0">
                            <div className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-full bg-[#1D4ED8]/10 text-[#1D4ED8] font-semibold text-xs md:text-sm">
                              {citationNumber}
                            </div>
                          </div>
                          
                          {/* Citation Content */}
                          <div className="flex-1 min-w-0">
                            <p className="text-[#1C1B17] text-sm leading-relaxed mb-2">
                              {citation.excerpt}
                            </p>
                            <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                              {citation.page && (
                                <span className="inline-flex items-center gap-1 text-xs text-[#6F6A60]">
                                  <span className="px-2 py-1 bg-[#1D4ED8]/10 text-[#1D4ED8] rounded border border-[#1D4ED8]/20 font-medium">
                                    Page {citation.page}
                                  </span>
                                </span>
                              )}
                              {citation.title && (
                                <span className="text-xs text-[#6F6A60] font-medium">
                                  {citation.title}
                                </span>
                              )}
                              {citation.source && !citation.title && (
                                <span className="text-xs text-[#6F6A60]">
                                  {citation.source}
                                </span>
                              )}
                              {citation.report_id && (
                                <button
                                  onClick={() => navigate(`/research/${citation.report_id}`)}
                                  className="inline-flex items-center gap-1 text-xs text-[#1D4ED8] hover:text-[#1D4ED8]/80 transition-colors font-medium"
                                >
                                  View Report
                                  <ExternalLink className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Relevant Reports */}
          {result.relevant_reports && result.relevant_reports.length > 0 && (
            <Card>
              <CardContent className="p-4 md:p-6">
                <h3 className="text-lg font-semibold text-[#1C1B17] mb-4">Relevant Reports</h3>
                <div className="grid gap-3">
                  {result.relevant_reports.map((report) => (
                    <div
                      key={report.id}
                      onClick={() => navigate(`/research/${report.id}`)}
                      className="p-4 bg-[#FBF7ED] border border-[#D7D0C2] rounded-lg hover:border-[#1D4ED8]/30 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <FileText className="w-4 h-4 md:w-5 md:h-5 text-[#1D4ED8] mt-0.5 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <h4 className="text-[#1C1B17] font-medium group-hover:text-[#1D4ED8] transition-colors text-sm md:text-base">
                              {report.title}
                            </h4>
                            <div className="flex items-center gap-2 md:gap-3 mt-1 text-xs text-[#6F6A60] flex-wrap">
                              {report.sector && <span>{report.sector}</span>}
                              {report.tickers && report.tickers.length > 0 && (
                                <span>{report.tickers.slice(0, 3).join(', ')}</span>
                              )}
                              <span>{new Date(report.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}


