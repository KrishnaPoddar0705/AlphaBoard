import { useState, useEffect } from 'react';
import { Plus, Search, Filter, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ReportCard from '../components/research/ReportCard';
import UploadReportModal from '../components/research/UploadReportModal';
import RAGSearchBar from '../components/research/RAGSearchBar';

interface Report {
  id: string;
  title: string;
  sector?: string;
  tickers?: string[];
  created_at: string;
  original_filename: string;
  upload_status: string;
  analyst?: {
    username: string;
  };
}

export default function ResearchLibrary() {
  const [reports, setReports] = useState<Report[]>([]);
  const [filteredReports, setFilteredReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [showRAGSearch, setShowRAGSearch] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  useEffect(() => {
    filterReports();
  }, [reports, searchTerm, sectorFilter]);

  const fetchReports = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('research_reports')
        .select(`
          id,
          title,
          sector,
          tickers,
          created_at,
          original_filename,
          upload_status,
          analyst:analyst_id (
            username
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform the data to handle the nested analyst object
      const transformedData = (data || []).map((report: any) => ({
        ...report,
        analyst: Array.isArray(report.analyst) ? report.analyst[0] : report.analyst,
      }));

      setReports(transformedData);
    } catch (err: any) {
      console.error('Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterReports = () => {
    let filtered = [...reports];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (report) =>
          report.title.toLowerCase().includes(term) ||
          report.original_filename.toLowerCase().includes(term) ||
          report.tickers?.some((ticker) => ticker.toLowerCase().includes(term))
      );
    }

    // Sector filter
    if (sectorFilter) {
      filtered = filtered.filter((report) => report.sector === sectorFilter);
    }

    setFilteredReports(filtered);
  };

  const uniqueSectors = Array.from(new Set(reports.map((r) => r.sector).filter(Boolean)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-purple-200">
            Institutional Memory
          </h1>
          <p className="text-gray-400 mt-1">
            Upload, search, and analyze research reports with AI-powered insights
          </p>
        </div>
        <button
          onClick={() => setUploadModalOpen(true)}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Upload Report
        </button>
      </div>

      {/* RAG Search */}
      {showRAGSearch && (
        <div className="animate-in fade-in duration-300">
          <RAGSearchBar />
        </div>
      )}

      {/* Toggle RAG Search */}
      <button
        onClick={() => setShowRAGSearch(!showRAGSearch)}
        className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
      >
        {showRAGSearch ? 'Hide' : 'Show'} AI Search
      </button>

      {/* Filters */}
      <div className="glass p-4 rounded-xl border border-white/10">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search reports by title, ticker..."
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Sector Filter */}
          <div className="md:w-64">
            <select
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">All Sectors</option>
              {uniqueSectors.map((sector) => (
                <option key={sector} value={sector}>
                  {sector}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters */}
          {(searchTerm || sectorFilter) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSectorFilter('');
              }}
              className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/10">
          <div className="text-sm">
            <span className="text-gray-400">Showing </span>
            <span className="text-white font-semibold">{filteredReports.length}</span>
            <span className="text-gray-400"> of {reports.length} reports</span>
          </div>
          {sectorFilter && (
            <div className="text-sm text-gray-400">
              Filtered by: <span className="text-white">{sectorFilter}</span>
            </div>
          )}
        </div>
      </div>

      {/* Reports Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      ) : filteredReports.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReports.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      ) : (
        <div className="glass p-12 rounded-xl border border-white/10 text-center">
          <Filter className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No reports found</h3>
          <p className="text-gray-400 mb-6">
            {reports.length === 0
              ? 'Upload your first research report to get started'
              : 'Try adjusting your filters or search terms'}
          </p>
          {reports.length === 0 && (
            <button
              onClick={() => setUploadModalOpen(true)}
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Upload Your First Report
            </button>
          )}
        </div>
      )}

      {/* Upload Modal */}
      <UploadReportModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={() => {
          fetchReports();
        }}
      />
    </div>
  );
}

