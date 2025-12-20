import { useState } from 'react';
import { Search, Loader2, FileText, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import MarkdownAnswer from './MarkdownAnswer';
import GraphRenderer from './GraphRenderer';

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
      console.error('Search error:', err);
      setError(err.message || 'Search failed');
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
    <div className="space-y-6">
      {/* Search Input */}
      <div className="glass p-6 rounded-xl border border-[var(--border-color)]">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-secondary)]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Ask a question about your research reports..."
              disabled={searching}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg pl-12 pr-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={!query.trim() || searching}
            className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {searching ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                Search
              </>
            )}
          </button>
        </div>

        {/* Example Queries */}
        {!result && !searching && (
          <div className="mt-4">
            <p className="text-sm text-[var(--text-secondary)] mb-2">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_QUERIES.map((example, index) => (
                <button
                  key={index}
                  onClick={() => handleExampleQuery(example)}
                  className="text-xs px-3 py-1.5 bg-[var(--bg-secondary)] hover:bg-[var(--list-item-hover)] border border-[var(--border-color)] rounded-full text-[var(--text-primary)] transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="glass p-4 rounded-lg border border-red-500/20 bg-red-500/10">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Answer */}
          <div className="glass p-6 rounded-xl border border-[var(--border-color)]">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Answer</h3>
              <span className="text-sm text-[var(--text-secondary)]">
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
          </div>

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
            <div className="glass p-6 rounded-xl border border-[var(--border-color)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                  References
                </h3>
                <span className="text-sm text-[var(--text-secondary)]">
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
                      className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-4 hover:border-indigo-500/50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        {/* Citation Number */}
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 flex items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 font-semibold text-sm">
                            {citationNumber}
                          </div>
                        </div>
                        
                        {/* Citation Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[var(--text-primary)] text-sm leading-relaxed mb-2">
                            {citation.excerpt}
                          </p>
                          <div className="flex items-center gap-3 flex-wrap">
                            {citation.page && (
                              <span className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                                <span className="px-2 py-1 bg-indigo-500/20 text-indigo-400 rounded">
                                  Page {citation.page}
                                </span>
                              </span>
                            )}
                            {citation.title && (
                              <span className="text-xs text-[var(--text-secondary)] font-medium">
                                {citation.title}
                              </span>
                            )}
                            {citation.source && !citation.title && (
                              <span className="text-xs text-[var(--text-secondary)]">
                                {citation.source}
                              </span>
                            )}
                            {citation.report_id && (
                              <button
                                onClick={() => navigate(`/research/${citation.report_id}`)}
                                className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
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
            </div>
          )}

          {/* Relevant Reports */}
          {result.relevant_reports && result.relevant_reports.length > 0 && (
            <div className="glass p-6 rounded-xl border border-[var(--border-color)]">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Relevant Reports</h3>
              <div className="grid gap-3">
                {result.relevant_reports.map((report) => (
                  <div
                    key={report.id}
                    onClick={() => navigate(`/research/${report.id}`)}
                    className="p-4 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg hover:border-blue-500/50 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <FileText className="w-5 h-5 text-indigo-500 mt-0.5" />
                        <div>
                          <h4 className="text-[var(--text-primary)] font-medium group-hover:text-indigo-500 transition-colors">
                            {report.title}
                          </h4>
                          <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-secondary)]">
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}

