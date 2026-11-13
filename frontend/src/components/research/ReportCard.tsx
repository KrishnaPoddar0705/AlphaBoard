import { FileText, Calendar, User, Tag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../ui/card-new';

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
    uploading: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    uploaded: 'bg-blue-100 text-blue-800 border-blue-200',
    indexing: 'bg-purple-100 text-purple-800 border-purple-200',
    indexed: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    parsing: 'bg-orange-100 text-orange-800 border-orange-200',
    parsed: 'bg-positive/10 text-positive border-positive/20',
    failed: 'bg-negative/10 text-negative border-negative/20',
  };

  const statusColor = statusColors[report.upload_status as keyof typeof statusColors] || 'bg-ink-faint/10 text-ink-faint border-ink-faint/20';

  return (
    <Card
      onClick={() => navigate(`/research/${report.id}`)}
      className="p-5 md:p-6 hover:shadow-lg transition-all cursor-pointer group hover:border-link/30"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4 gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="p-2 bg-link/10 rounded-lg flex-shrink-0">
            <FileText className="w-4 h-4 md:w-5 md:h-5 text-link" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-ink font-semibold group-hover:text-link transition-colors text-sm md:text-base line-clamp-2">
              {report.title}
            </h3>
            <p className="text-xs md:text-sm text-ink-muted mt-1 truncate">{report.original_filename}</p>
          </div>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium border ${statusColor} flex-shrink-0 capitalize`}>
          {report.upload_status}
        </span>
      </div>

      {/* Metadata */}
      <div className="space-y-3">
        {report.sector && (
          <div className="flex items-center gap-2 text-sm text-ink">
            <Tag className="w-4 h-4 text-ink-muted" />
            <span className="text-ink-muted">{report.sector}</span>
          </div>
        )}

        {report.tickers && report.tickers.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {report.tickers.slice(0, 5).map((ticker, index) => (
              <span
                key={`${ticker}-${index}`}
                className="px-2 py-1 bg-paper-alt border border-border-editorial rounded text-xs text-ink font-medium"
              >
                {ticker}
              </span>
            ))}
            {report.tickers.length > 5 && (
              <span className="px-2 py-1 text-xs text-ink-muted">
                +{report.tickers.length - 5} more
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 mt-2 border-t border-border-editorial gap-4">
          <div className="flex items-center gap-2 text-xs md:text-sm text-ink-muted">
            <Calendar className="w-3 h-3 md:w-4 md:h-4" />
            <span>{new Date(report.created_at).toLocaleDateString()}</span>
          </div>
          {report.analyst && (
            <div className="flex items-center gap-2 text-xs md:text-sm text-ink-muted">
              <User className="w-3 h-3 md:w-4 md:h-4" />
              <span className="truncate max-w-[100px] md:max-w-none">{report.analyst.username}</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

