import { lazy, Suspense, useState } from 'react';
import { Download, Loader2, MessageSquarePlus, Check, Pencil, X } from 'lucide-react';
import EditReportDialog from './EditReportDialog';
import PdfErrorBoundary from './pdf/PdfErrorBoundary';
import ReportSummary from './ReportSummary';
import { brokerOf } from '../../../lib/researchFolders';
import { useReportDetail } from '../../../hooks/useResearchReports';

// PDF.js is about 1 MB; it loads the first time a report is opened, not with the app.
const PdfViewer = lazy(() => import('./pdf/PdfViewer'));

interface DocumentViewProps {
  reportId: string;
  page: number | null;
  findText: string;
  onPage: (page: number) => void;
  onClose: () => void;
  inScope: boolean;
  onToggleScope: () => void;
  brokers: string[];
  sectors: string[];
}

export default function DocumentView({ reportId, page, findText, onPage, onClose, inScope, onToggleScope, brokers, sectors }: DocumentViewProps) {
  const [editing, setEditing] = useState(false);
  const { data: report, isLoading, error } = useReportDetail(reportId);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-start gap-3 border-b border-[#E4DDCC] px-4 py-3 md:px-6">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold leading-snug text-[#1C1B17] md:text-lg">
            {report?.title ?? (isLoading ? 'Opening report…' : 'Report not found')}
          </h2>
          {report && (
            <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-[#6F6A60]">
              {brokerOf(report) !== 'Unfiled' && <span>{brokerOf(report)}</span>}
              {report.sector && <span>{report.sector}</span>}
              {!!report.tickers?.length && <span className="font-medium text-[#1C1B17]">{report.tickers.join(' · ')}</span>}
              <span>{new Date(report.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              {report.analyst && <span>uploaded by {report.analyst.username}</span>}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={onToggleScope}
            aria-pressed={inScope}
            className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors active:scale-[0.97] ${inScope ? 'bg-[#1D4ED8]/10 text-[#1D4ED8]' : 'text-[#1C1B17] hover:bg-[#1C1B17]/[0.05]'}`}
          >
            {inScope ? <Check className="h-3.5 w-3.5" /> : <MessageSquarePlus className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{inScope ? 'In your question' : 'Ask about this'}</span>
          </button>
          {report && (
            <button
              onClick={() => setEditing(true)}
              aria-label="Edit broker, title and sector"
              title="Edit broker, title and sector"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#1C1B17] hover:bg-[#1C1B17]/[0.05] disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          <a
            href={report?.pdfUrl || undefined}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!report?.pdfUrl}
            aria-label="Download PDF"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#1C1B17] hover:bg-[#1C1B17]/[0.05] aria-disabled:pointer-events-none aria-disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
          </a>
          <button onClick={onClose} aria-label="Close report" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#6F6A60] hover:bg-[#1C1B17]/[0.05] hover:text-[#1C1B17]">
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {report && editing && (
        <EditReportDialog key={report.id} report={report} open onClose={() => setEditing(false)} brokers={brokers} sectors={sectors} />
      )}

      {isLoading && <p className="flex items-center gap-2 p-6 text-sm text-[#6F6A60]"><Loader2 className="h-4 w-4 animate-spin" />Loading the report…</p>}
      {error && <p className="p-6 text-sm text-[#B23B2A]">This report could not be opened. It may have been deleted, or you may not have access.</p>}

      {report && (
        <>
          {/* AI insights run across the top; the PDF keeps the full width under them. */}
          <ReportSummary parsed={report.parsed ?? {}} status={report.upload_status} onJumpToPage={onPage} />
          <div className="min-h-0 flex-1 bg-[#E9E5D6]">
            {report.pdfUrl ? (
              <PdfErrorBoundary key={report.pdfUrl} url={report.pdfUrl}>
                <Suspense fallback={<p className="flex items-center gap-2 p-6 text-sm text-[#6F6A60]"><Loader2 className="h-4 w-4 animate-spin" />Opening the PDF…</p>}>
                  <PdfViewer url={report.pdfUrl} title={report.title} page={page} findText={findText} />
                </Suspense>
              </PdfErrorBoundary>
            ) : (
              <p className="p-6 text-sm text-[#6F6A60]">The PDF file is not available for this report.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
