import { useState, useEffect } from 'react';
import { Plus, Search, Filter, Loader2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ReportCard from '../components/research/ReportCard';
import UploadReportModal from '../components/research/UploadReportModal';
import RAGSearchBar from '../components/research/RAGSearchBar';
import SectorDropdown from '../components/ui/SectorDropdown';
import TickerFilter from '../components/ui/TickerFilter';
import { Card, CardContent } from '../components/ui/card-new';
import { Button } from '../components/ui/button';

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

const STATUS_OPTIONS = [
  'uploading',
  'uploaded',
  'indexing',
  'indexed',
  'parsing',
  'parsed',
  'failed',
];

export default function ResearchLibrary() {
  const [reports, setReports] = useState<Report[]>([]);
  const [filteredReports, setFilteredReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tickerFilter, setTickerFilter] = useState<string[]>([]);
  const [showRAGSearch, setShowRAGSearch] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  useEffect(() => {
    filterReports();
  }, [reports, searchTerm, sectorFilter, statusFilter, tickerFilter]);

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

    // Status filter
    if (statusFilter) {
      filtered = filtered.filter((report) => report.upload_status === statusFilter);
    }

    // Ticker filter (show reports that contain any of the selected tickers)
    if (tickerFilter.length > 0) {
      filtered = filtered.filter((report) =>
        report.tickers?.some((ticker) =>
          tickerFilter.some((filterTicker) =>
            ticker.toUpperCase() === filterTicker.toUpperCase()
          )
        )
      );
    }

    setFilteredReports(filtered);
  };

  const uniqueSectors = Array.from(new Set(reports.map((r) => r.sector).filter((s): s is string => Boolean(s)))).sort();
  
  // Get all unique tickers from reports
  const allTickers = Array.from(
    new Set(
      reports
        .flatMap((r) => r.tickers || [])
        .map((t) => t.toUpperCase())
    )
  ).sort();

  const clearAllFilters = () => {
    setSearchTerm('');
    setSectorFilter('');
    setStatusFilter('');
    setTickerFilter([]);
  };

  const hasActiveFilters = searchTerm || sectorFilter || statusFilter || tickerFilter.length > 0;

  return (
    <div className="p-5 md:p-7 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-[#1C1B17] tracking-tight">
            Institutional Memory
          </h1>
          <p className="text-[#6F6A60] mt-1 text-sm md:text-base">
            Upload, search, and analyze research reports with AI-powered insights
          </p>
        </div>
        <Button
          onClick={() => setUploadModalOpen(true)}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Upload Report</span>
          <span className="sm:hidden">Upload</span>
        </Button>
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
        className="text-sm text-[#1D4ED8] hover:text-[#1D4ED8]/80 transition-colors font-medium"
      >
        {showRAGSearch ? 'Hide' : 'Show'} AI Search
      </button>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 md:p-6">
          <div className="space-y-4">
            {/* First Row: Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-[#6F6A60]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search reports by title, ticker..."
                className="w-full bg-[#FBF7ED] border border-[#D7D0C2] rounded-lg pl-9 md:pl-10 pr-4 py-2 text-[#1C1B17] placeholder-[#8B857A] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8] transition-all text-sm md:text-base"
              />
            </div>

            {/* Second Row: Sector, Status, and Ticker Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Sector Filter */}
              <div className="relative">
                <label className="block text-xs font-medium text-[#1C1B17] mb-2">
                  Sector
                </label>
                <SectorDropdown
                  value={sectorFilter}
                  onChange={setSectorFilter}
                  options={uniqueSectors}
                  placeholder="All Sectors"
                />
              </div>

              {/* Status Filter */}
              <div className="relative">
                <label className="block text-xs font-medium text-[#1C1B17] mb-2">
                  Status
                </label>
                <SectorDropdown
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={STATUS_OPTIONS}
                  placeholder="All Statuses"
                />
              </div>

              {/* Ticker Filter */}
              <div className="relative">
                <label className="block text-xs font-medium text-[#1C1B17] mb-2">
                  Tickers
                </label>
                <TickerFilter
                  value={tickerFilter}
                  onChange={setTickerFilter}
                  options={allTickers}
                  placeholder="Select tickers..."
                />
              </div>
            </div>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <div className="flex justify-end">
                <button
                  onClick={clearAllFilters}
                  className="px-4 py-2 text-sm text-[#6F6A60] hover:text-[#1C1B17] transition-colors flex items-center gap-2 font-medium"
                >
                  <X className="w-4 h-4" />
                  Clear All Filters
                </button>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-[#D7D0C2]">
            <div className="text-sm">
              <span className="text-[#6F6A60]">Showing </span>
              <span className="text-[#1C1B17] font-semibold">{filteredReports.length}</span>
              <span className="text-[#6F6A60]"> of {reports.length} reports</span>
            </div>
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-[#6F6A60]">
                <span>Filters:</span>
                {sectorFilter && (
                  <span className="px-2 py-1 bg-[#1D4ED8]/10 rounded text-[#1C1B17] text-xs font-medium border border-[#1D4ED8]/20">
                    Sector: {sectorFilter}
                  </span>
                )}
                {statusFilter && (
                  <span className="px-2 py-1 bg-[#1D4ED8]/10 rounded text-[#1C1B17] text-xs font-medium border border-[#1D4ED8]/20">
                    Status: {statusFilter}
                  </span>
                )}
                {tickerFilter.length > 0 && (
                  <span className="px-2 py-1 bg-[#1D4ED8]/10 rounded text-[#1C1B17] text-xs font-medium border border-[#1D4ED8]/20">
                    Tickers: {tickerFilter.length}
                  </span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reports Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#1D4ED8] animate-spin" />
        </div>
      ) : filteredReports.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredReports.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <Filter className="w-12 h-12 text-[#8B857A] mx-auto" />
            <h3 className="text-xl font-semibold text-[#1C1B17]">No reports found</h3>
            <p className="text-[#6F6A60]">
              {reports.length === 0
                ? 'Upload your first research report to get started'
                : 'Try adjusting your filters or search terms'}
            </p>
            {reports.length === 0 && (
              <Button
                onClick={() => setUploadModalOpen(true)}
                className="inline-flex items-center gap-2 mt-4"
              >
                <Plus className="w-4 h-4" />
                Upload Your First Report
              </Button>
            )}
          </CardContent>
        </Card>
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

