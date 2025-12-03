import { FileText, Calendar, User, Tag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ReportCardProps {
  report: {
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
  };
}

export default function ReportCard({ report }: ReportCardProps) {
  const navigate = useNavigate();

  const statusColors = {
    uploading: 'bg-yellow-500/20 text-yellow-300',
    uploaded: 'bg-blue-500/20 text-blue-300',
    indexing: 'bg-purple-500/20 text-purple-300',
    indexed: 'bg-indigo-500/20 text-indigo-300',
    parsing: 'bg-orange-500/20 text-orange-300',
    parsed: 'bg-green-500/20 text-green-300',
    failed: 'bg-red-500/20 text-red-300',
  };

  const statusColor = statusColors[report.upload_status as keyof typeof statusColors] || 'bg-gray-500/20 text-gray-300';

  return (
    <div
      onClick={() => navigate(`/research/${report.id}`)}
      className="glass p-6 rounded-lg border border-white/10 hover:border-blue-500/50 transition-all cursor-pointer group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <FileText className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold group-hover:text-blue-400 transition-colors">
              {report.title}
            </h3>
            <p className="text-sm text-gray-400">{report.original_filename}</p>
          </div>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor}`}>
          {report.upload_status}
        </span>
      </div>

      {/* Metadata */}
      <div className="space-y-2">
        {report.sector && (
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <Tag className="w-4 h-4" />
            <span>{report.sector}</span>
          </div>
        )}

        {report.tickers && report.tickers.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {report.tickers.slice(0, 5).map((ticker) => (
              <span
                key={ticker}
                className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-gray-300"
              >
                {ticker}
              </span>
            ))}
            {report.tickers.length > 5 && (
              <span className="px-2 py-1 text-xs text-gray-400">
                +{report.tickers.length - 5} more
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 mt-2 border-t border-white/5">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Calendar className="w-4 h-4" />
            <span>{new Date(report.created_at).toLocaleDateString()}</span>
          </div>
          {report.analyst && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <User className="w-4 h-4" />
              <span>{report.analyst.username}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

