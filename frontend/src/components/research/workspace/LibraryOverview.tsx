import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Landmark, Tag, Upload } from 'lucide-react';
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
/** "[Kotak] Consumer Durables…" reads as "Consumer Durables…" once the broker has its own mark. */
const bareTitle = (title: string) => title.replace(/^\s*\[[^\]]{1,40}\]\s*/, '');

/** A PDF as a pill: the file mark, its title, then who wrote it and what it covers. */
function ReportPill({ report, onOpen }: { report: LibraryReport; onOpen: () => void }) {
  const broker = brokerOf(report);
  return (
    <button
      onClick={onOpen}
      title={report.title}
      className="group inline-flex max-w-[420px] shrink-0 snap-start items-center gap-2.5 rounded-full border border-[#E4DDCC] bg-[#FBF7ED] py-1.5 pl-1.5 pr-4 text-left transition-colors hover:border-[#1D4ED8]/40 active:scale-[0.99]"
    >
      <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#B23B2A]/10 text-[9px] font-bold tracking-wide text-[#B23B2A]">PDF</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-[#1C1B17] group-hover:text-[#1D4ED8]">{bareTitle(report.title)}</span>
        <span className="mt-0.5 flex items-center gap-3 text-xs text-[#6F6A60]">
          {broker !== 'Unfiled' && (
            <span className="inline-flex items-center gap-1" title="Broker"><Landmark className="h-3 w-3" />{broker}</span>
          )}
          {report.sector && (
            <span className="inline-flex min-w-0 items-center gap-1" title="Sector"><Tag className="h-3 w-3 shrink-0" /><span className="truncate">{report.sector}</span></span>
          )}
          <span className="shrink-0 tabular-nums">{shortDate(report.created_at)}</span>
        </span>
      </span>
    </button>
  );
}

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
      <div className="flex h-full items-center justify-center px-6 pb-40">
        <motion.div {...rise(0)} className="max-w-lg">
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
    <div className="h-full overflow-y-auto pb-44 pt-8 md:pt-12">
      <div className="mx-auto max-w-4xl px-4 md:px-10">
        <motion.h2 {...rise(0)} className="text-[28px] font-semibold leading-[1.1] tracking-tight text-[#1C1B17] md:text-[40px]">
          What does {orgName} know?
        </motion.h2>
        <motion.p {...rise(1)} className="mt-3 max-w-2xl text-sm leading-relaxed text-[#1C1B17] md:text-base">
          Open a report from the folders, or use the box below: Ask to have the Brain read across every report, Search to find a title or a phrase on any page.
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

        <motion.section {...rise(3)} className="mt-10">
          <h3 className="text-[13px] font-semibold text-[#1C1B17]">Questions to start with</h3>
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {suggestions.slice(0, 4).map((q) => (
              <li key={q}>
                <button
                  onClick={() => onAsk(q)}
                  className="group flex h-full w-full items-start justify-between gap-3 rounded-lg bg-[#1C1B17]/[0.035] px-3.5 py-3 text-left text-sm leading-snug text-[#1C1B17] transition-colors hover:bg-[#1D4ED8]/[0.08] hover:text-[#1D4ED8]"
                >
                  {q}
                  <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8B857A] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#1D4ED8]" />
                </button>
              </li>
            ))}
          </ul>
        </motion.section>
      </div>

      <motion.section {...rise(4)} className="mx-auto mt-10 max-w-4xl">
        <h3 className="px-4 text-[13px] font-semibold text-[#1C1B17] md:px-10">Recently added</h3>
        <div className="mt-3 flex snap-x gap-2 overflow-x-auto px-4 pb-2 md:px-10">
          {reports.slice(0, 10).map((r) => <ReportPill key={r.id} report={r} onOpen={() => onOpen(r.id)} />)}
        </div>
      </motion.section>
    </div>
  );
}
