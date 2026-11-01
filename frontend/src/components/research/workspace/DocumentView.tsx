import { useEffect, useRef, useState } from 'react';
import { Download, Loader2, MessageSquarePlus, Check, X } from 'lucide-react';
import { useReportDetail } from '../../../hooks/useResearchReports';
import ReportSummary from './ReportSummary';

interface DocumentViewProps {
  reportId: string;
  page: number | null;
  findText: string;
  onPage: (page: number) => void;
  onClose: () => void;
  inScope: boolean;
  onToggleScope: () => void;
}

/** Below this width the preview and the summary take turns instead of sitting side by side. */
const SPLIT_MIN = 860;

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export default function DocumentView({ reportId, page, findText, onPage, onClose, inScope, onToggleScope }: DocumentViewProps) {
  const { data: report, isLoading, error } = useReportDetail(reportId);
  const [ref, width] = useWidth<HTMLDivElement>();
  const [pane, setPane] = useState<'preview' | 'summary'>('summary');
  const split = width >= SPLIT_MIN;

  // A page jump (from the summary, a search hit or a chat citation) should land on the
  // preview when the two panes take turns.
  const jumpKey = page ? `${reportId}:${page}` : null;
  const [seenJump, setSeenJump] = useState(jumpKey);
  if (jumpKey !== seenJump) {
    setSeenJump(jumpKey);
    if (jumpKey) setPane('preview');
  }
  const jump = (p: number) => onPage(p);

  const pdfSrc = report?.pdfUrl
    ? `${report.pdfUrl}#page=${page ?? 1}${findText ? `&search=${encodeURIComponent(findText)}` : ''}`
    : '';

  return (
    <div ref={ref} className="flex h-full min-h-0 flex-col">
      <header className="flex items-start gap-3 border-b border-[#E4DDCC] px-4 py-3 md:px-6">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold leading-snug text-[#1C1B17] md:text-lg">
            {report?.title ?? (isLoading ? 'Opening report…' : 'Report not found')}
          </h2>
          {report && (
            <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-[#6F6A60]">
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

      {!split && (
        <div role="tablist" className="flex gap-4 border-b border-[#E4DDCC] px-4 text-sm md:px-6">
          {(['summary', 'preview'] as const).map((p) => (
            <button
              key={p}
              role="tab"
              aria-selected={pane === p}
              onClick={() => setPane(p)}
              className={`-mb-px border-b-2 py-2 ${pane === p ? 'border-[#1C1B17] font-medium text-[#1C1B17]' : 'border-transparent text-[#6F6A60] hover:text-[#1C1B17]'}`}
            >
              {p === 'summary' ? 'AI summary' : 'PDF'}
            </button>
          ))}
        </div>
      )}

      {isLoading && <p className="flex items-center gap-2 p-6 text-sm text-[#6F6A60]"><Loader2 className="h-4 w-4 animate-spin" />Loading the report…</p>}
      {error && <p className="p-6 text-sm text-[#B23B2A]">This report could not be opened. It may have been deleted, or you may not have access.</p>}

      {report && (
        <div className="flex min-h-0 flex-1">
          {(split || pane === 'preview') && (
            <div className="min-w-0 flex-1 bg-[#E9E5D6]">
              {pdfSrc ? (
                <iframe key={pdfSrc} src={pdfSrc} title={`${report.title} PDF`} className="h-full w-full" />
              ) : (
                <p className="p-6 text-sm text-[#6F6A60]">The PDF file is not available for this report.</p>
              )}
            </div>
          )}
          {(split || pane === 'summary') && (
            <aside aria-label="AI summary" className={`min-h-0 overflow-y-auto px-4 py-5 pb-28 md:px-6 ${split ? 'w-[360px] shrink-0 border-l border-[#E4DDCC] xl:w-[400px]' : 'flex-1'}`}>
              {split && <h3 className="mb-3 text-xs font-medium text-[#6F6A60]">AI summary</h3>}
              <ReportSummary parsed={report.parsed ?? {}} status={report.upload_status} onJumpToPage={jump} />
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
