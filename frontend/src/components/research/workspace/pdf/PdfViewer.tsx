import { useEffect, useMemo, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Download, Loader2, Maximize2, Minus, Plus } from 'lucide-react';
import PdfPage from './PdfPage';
import './pdfViewer.css';

GlobalWorkerOptions.workerSrc = workerUrl;

interface PdfViewerProps {
  url: string;
  title: string;
  /** Scrolls to this page whenever it changes. */
  page: number | null;
  /** Words to highlight, from the search that opened the report. */
  findText: string;
}

const ZOOMS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const GUTTER = 32; // px of paper on each side of a page at fit width

/** The report PDF, drawn by PDF.js on AlphaBoard paper rather than in the browser's dark viewer.
 *  Mounted with `key={url}`, so a new file gets a fresh viewer instead of resetting state. */
export default function PdfViewer({ url, title, page, findText }: PdfViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [base, setBase] = useState<{ w: number; h: number } | null>(null);
  const [error, setError] = useState(false);
  const [width, setWidth] = useState(0);
  const [zoom, setZoom] = useState(1); // relative to fit width
  const [current, setCurrent] = useState(1);
  const [pageDraft, setPageDraft] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const task = getDocument({ url });
    task.promise.then(async (d) => {
      const first = await d.getPage(1);
      const vp = first.getViewport({ scale: 1 });
      if (cancelled) return;
      setBase({ w: vp.width, h: vp.height });
      setDoc(d);
    }).catch(() => !cancelled && setError(true));
    return () => { cancelled = true; task.destroy(); };
  }, [url]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = base && width ? Math.max((width - GUTTER * 2) / base.w, 0.2) : 1;
  const scale = fit * zoom;
  const pageWidth = base ? base.w * scale : 0;
  const terms = useMemo(() => findText.toLowerCase().split(/\s+/).filter((w) => w.length >= 3), [findText]);

  const scrollToPage = (n: number, smooth = true) => {
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-page="${n}"]`);
    el?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  };

  // Jump when asked from outside (a search hit, a citation, the summary), once pages exist.
  useEffect(() => {
    if (doc && page) requestAnimationFrame(() => scrollToPage(Math.min(page, doc.numPages), false));
  }, [doc, page]);

  // The page counter follows the page that fills the top half of the view.
  const onScroll = () => {
    const box = scrollRef.current;
    if (!box) return;
    const mid = box.getBoundingClientRect().top + box.clientHeight * 0.35;
    for (const el of box.querySelectorAll<HTMLElement>('[data-page]')) {
      const r = el.getBoundingClientRect();
      if (r.top <= mid && r.bottom >= mid) { setCurrent(Number(el.dataset.page)); break; }
    }
  };

  const step = (dir: 1 | -1) => {
    const i = ZOOMS.findIndex((z) => z >= zoom - 1e-6);
    setZoom(ZOOMS[Math.min(Math.max((i === -1 ? ZOOMS.length - 1 : i) + dir, 0), ZOOMS.length - 1)]);
  };

  const commitPage = () => {
    const n = Number(pageDraft);
    if (doc && n >= 1 && n <= doc.numPages) scrollToPage(n);
    setPageDraft(null);
  };

  const btn = 'inline-flex h-7 w-7 items-center justify-center rounded-md text-[#1C1B17] transition-colors hover:bg-[#1C1B17]/[0.06] disabled:opacity-40';

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#E9E5D6]">
      <div aria-label={`${title}, PDF controls`} className="flex shrink-0 items-center justify-center gap-1 border-b border-[#E4DDCC] bg-[#F6F3E8] px-3 py-1.5 text-xs text-[#1C1B17]">
        <label className="flex items-center gap-1 tabular-nums">
          <span className="sr-only">Page</span>
          <input
            value={pageDraft ?? String(current)}
            onChange={(e) => setPageDraft(e.target.value.replace(/\D/g, ''))}
            onBlur={commitPage}
            onKeyDown={(e) => e.key === 'Enter' && commitPage()}
            inputMode="numeric"
            className="h-7 w-9 rounded-md border border-[#D7D0C2] bg-[#FBF7ED] text-center focus:border-[#1C1B17]/50 focus:outline-none"
          />
          <span className="text-[#6F6A60]">/ {doc?.numPages ?? '–'}</span>
        </label>
        <span className="mx-1 h-4 w-px bg-[#D7D0C2]" aria-hidden />
        <button onClick={() => step(-1)} disabled={zoom <= ZOOMS[0]} aria-label="Zoom out" className={btn}><Minus className="h-3.5 w-3.5" /></button>
        <button onClick={() => setZoom(1)} title="Fit to width" className="h-7 min-w-[3.25rem] rounded-md px-1 tabular-nums hover:bg-[#1C1B17]/[0.06]">
          {Math.round(scale * 100)}%
        </button>
        <button onClick={() => step(1)} disabled={zoom >= ZOOMS[ZOOMS.length - 1]} aria-label="Zoom in" className={btn}><Plus className="h-3.5 w-3.5" /></button>
        <button onClick={() => setZoom(1)} aria-label="Fit to width" title="Fit to width" className={btn}><Maximize2 className="h-3.5 w-3.5" /></button>
        <a href={url} target="_blank" rel="noreferrer" aria-label="Open or download the PDF" title="Open or download" className={btn}><Download className="h-3.5 w-3.5" /></a>
      </div>

      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-auto">
        {error && <p className="p-6 text-sm text-[#B23B2A]">The PDF could not be displayed. <a href={url} target="_blank" rel="noreferrer" className="underline">Open it in a new tab</a>.</p>}
        {!error && !doc && <p className="flex items-center gap-2 p-6 text-sm text-[#6F6A60]"><Loader2 className="h-4 w-4 animate-spin" />Opening the PDF…</p>}
        {doc && base && width > 0 && (
          <div className="flex flex-col gap-4 py-5 pb-40" style={{ minWidth: pageWidth + GUTTER * 2 }}>
            {Array.from({ length: doc.numPages }, (_, i) => (
              <PdfPage key={i + 1} doc={doc} number={i + 1} scale={scale} aspect={base.w / base.h} width={pageWidth} terms={terms} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
