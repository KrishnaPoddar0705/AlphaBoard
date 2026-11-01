import { motion, useReducedMotion } from 'framer-motion';
import { FileText, Upload } from 'lucide-react';
import { brokerOf } from '../../../lib/researchFolders';
import type { LibraryReport } from '../../../types/researchLibrary';

interface LibraryOverviewProps {
  orgName: string;
  reports: LibraryReport[];
  loading: boolean;
  onOpen: (id: string) => void;
  onUpload: () => void;
  onAsk: (q: string) => void;
  suggestions: string[];
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** The centre of the workspace when nothing is open: what the library holds and where to start. */
export default function LibraryOverview({ orgName, reports, loading, onOpen, onUpload, onAsk, suggestions }: LibraryOverviewProps) {
  const reduce = useReducedMotion();
  const rise = (i: number) => (reduce ? {} : {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: 0.05 + i * 0.07, duration: 0.35, ease: [0.2, 0.8, 0.2, 1] as const },
  });

  const sectors = new Set(reports.map((r) => r.sector).filter(Boolean)).size;
  const brokers = new Set(reports.map(brokerOf).filter((b) => b !== 'Unfiled')).size;
  const tickers = new Set(reports.flatMap((r) => r.tickers ?? [])).size;
  const processing = reports.filter((r) => !['parsed', 'failed'].includes(r.upload_status)).length;

  if (!loading && reports.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 pb-32">
        <motion.div {...rise(0)} className="max-w-md">
          <h2 className="text-2xl font-semibold tracking-tight text-[#1C1B17]">{orgName}’s memory is empty</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#1C1B17]">
            Upload broker notes, sector primers and your own write-ups. Each PDF is read, summarised and indexed so anyone on the desk can search it or ask questions across all of it.
          </p>
          <button onClick={onUpload} className="mt-5 inline-flex h-9 items-center gap-2 rounded-md bg-[#1C1B17] px-3.5 text-sm font-medium text-[#FBF7ED] active:scale-[0.98]">
            <Upload className="h-4 w-4" /> Upload the first report
          </button>
        </motion.div>
      </div>
    );
  }

  const stats: Array<[number, string]> = [
    [reports.length, reports.length === 1 ? 'report' : 'reports'],
    [sectors, sectors === 1 ? 'sector' : 'sectors'],
    [brokers, brokers === 1 ? 'broker' : 'brokers'],
    [tickers, tickers === 1 ? 'ticker covered' : 'tickers covered'],
  ];

  return (
    <div className="h-full overflow-y-auto px-4 pb-40 pt-8 md:px-10 md:pt-12">
      <div className="mx-auto max-w-3xl">
        <motion.h2 {...rise(0)} className="text-[28px] font-semibold leading-[1.1] tracking-tight text-[#1C1B17] md:text-[40px]">
          What does {orgName} know?
        </motion.h2>
        <motion.p {...rise(1)} className="mt-3 max-w-xl text-sm leading-relaxed text-[#1C1B17] md:text-base">
          Open a report from the folders, search every page from the box on the left, or ask the Brain below to read across all of them.
        </motion.p>

        <motion.dl {...rise(2)} className="mt-8 grid grid-cols-2 gap-y-4 sm:grid-cols-4">
          {stats.map(([n, label]) => (
            <div key={label}>
              <dt className="sr-only">{label}</dt>
              <dd className="text-2xl font-semibold tabular-nums text-[#1C1B17]">{loading ? '–' : n}</dd>
              <dd className="text-xs text-[#6F6A60]">{label}</dd>
            </div>
          ))}
        </motion.dl>
        {processing > 0 && (
          <p className="mt-3 flex items-center gap-2 text-xs text-[#6F6A60]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#B7791F]" />
            {processing} still being read; they can be searched once indexing finishes.
          </p>
        )}

        <div className="mt-10 grid gap-10 md:grid-cols-[1fr_0.9fr]">
          <motion.section {...rise(3)}>
            <h3 className="text-[13px] font-semibold text-[#1C1B17]">Recently added</h3>
            <ul className="mt-2">
              {reports.slice(0, 6).map((r) => (
                <li key={r.id}>
                  <button onClick={() => onOpen(r.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-[#1C1B17] transition-colors hover:bg-[#1C1B17]/[0.04]">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-[#8B857A]" />
                    <span className="truncate">{r.title}</span>
                    <span className="ml-auto shrink-0 pl-2 text-xs tabular-nums text-[#8B857A]">{shortDate(r.created_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.section>

          <motion.section {...rise(4)}>
            <h3 className="text-[13px] font-semibold text-[#1C1B17]">Questions to start with</h3>
            <ul className="mt-2 space-y-1">
              {suggestions.slice(0, 4).map((q) => (
                <li key={q}>
                  <button onClick={() => onAsk(q)} className="w-full rounded-md px-2 py-2 text-left text-sm text-[#1C1B17] transition-colors hover:bg-[#1D4ED8]/[0.07] hover:text-[#1D4ED8]">
                    {q}
                  </button>
                </li>
              ))}
            </ul>
          </motion.section>
        </div>
      </div>
    </div>
  );
}
