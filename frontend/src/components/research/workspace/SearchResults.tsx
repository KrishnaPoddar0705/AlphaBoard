import { FileText, Loader2, Sparkles } from 'lucide-react';
import { groupByReport, splitSnippet, type KeywordHit } from '../../../lib/researchSearch';
import { getUserFriendlyError } from '../../../lib/errorSanitizer';
import type { LibraryReport } from '../../../types/researchLibrary';

interface SearchResultsProps {
  query: string;
  titleMatches: LibraryReport[];
  hits: KeywordHit[] | undefined;
  loading: boolean;
  error: unknown;
  onOpen: (reportId: string, page?: number) => void;
  /** Hands the same words to the Brain as a question. */
  onAsk: (question: string) => void;
}

function Snippet({ text }: { text: string }) {
  return (
    <p className="text-sm leading-relaxed text-[#1C1B17]">
      …{splitSnippet(text).map((p, i) =>
        p.hit ? <mark key={i} className="rounded-sm bg-[#FDE68A] px-0.5 text-[#1C1B17]">{p.text}</mark> : <span key={i}>{p.text}</span>,
      )}…
    </p>
  );
}

/** What the search box found: report titles first, then the pages where the words appear. */
export default function SearchResults({ query, titleMatches, hits, loading, error, onOpen, onAsk }: SearchResultsProps) {
  const groups = groupByReport(hits ?? []);
  const pageCount = groups.reduce((n, g) => n + g.totalHits, 0);

  return (
    <div className="h-full overflow-y-auto px-4 pb-32 pt-5 md:px-8">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-lg font-semibold text-[#1C1B17]">Results for “{query}”</h2>
        <p className="mt-1 text-sm text-[#6F6A60]">
          {titleMatches.length} title{titleMatches.length === 1 ? '' : 's'}
          {hits && <> · {pageCount} page{pageCount === 1 ? '' : 's'} in {groups.length} report{groups.length === 1 ? '' : 's'}</>}
        </p>
        <button
          onClick={() => onAsk(query)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-[#1D4ED8]/10 px-3 py-1.5 text-sm font-medium text-[#1D4ED8] transition-colors hover:bg-[#1D4ED8]/15 active:scale-[0.98]"
        >
          <Sparkles className="h-3.5 w-3.5" /> Ask the Brain about “{query.length > 40 ? `${query.slice(0, 40)}…` : query}”
        </button>

        {titleMatches.length > 0 && (
          <section className="mt-7">
            <h3 className="text-[13px] font-semibold text-[#1C1B17]">Matching titles</h3>
            <ul className="mt-2">
              {titleMatches.slice(0, 8).map((r) => (
                <li key={r.id}>
                  <button onClick={() => onOpen(r.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-[#1C1B17] hover:bg-[#1C1B17]/[0.04]">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-[#8B857A]" />
                    <span className="truncate">{r.title}</span>
                    <span className="ml-auto shrink-0 pl-2 text-xs text-[#8B857A]">{r.sector ?? ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-7">
          <h3 className="text-[13px] font-semibold text-[#1C1B17]">Inside the reports</h3>
          {loading && <p className="mt-2 flex items-center gap-2 text-sm text-[#6F6A60]"><Loader2 className="h-4 w-4 animate-spin" />Searching every page…</p>}
          {!!error && <p className="mt-2 text-sm text-[#B23B2A]">{getUserFriendlyError(error)}</p>}
          {!loading && !error && query.length < 2 && <p className="mt-2 text-sm text-[#6F6A60]">Type at least two letters to search report text.</p>}
          {!loading && !error && hits && groups.length === 0 && (
            <p className="mt-2 text-sm text-[#1C1B17]">These words do not appear in any report’s text. The Brain may still find related passages.</p>
          )}

          <div className="mt-3 space-y-5">
            {groups.map((g) => (
              <article key={g.report_id}>
                <button onClick={() => onOpen(g.report_id)} className="flex max-w-full items-center gap-1.5 text-left text-sm font-semibold text-[#1C1B17] hover:text-[#1D4ED8]">
                  <FileText className="h-4 w-4 shrink-0 text-[#8B857A]" />
                  <span className="truncate">{g.title}</span>
                  <span className="shrink-0 font-normal text-[#8B857A]">· {g.totalHits} page{g.totalHits === 1 ? '' : 's'}</span>
                </button>
                <ul className="mt-1.5 space-y-1">
                  {g.hits.slice(0, 4).map((h) => (
                    <li key={h.page_number}>
                      <button onClick={() => onOpen(g.report_id, h.page_number)} className="group flex w-full gap-3 rounded-md px-2 py-1.5 text-left hover:bg-[#1C1B17]/[0.04]">
                        <span className="w-12 shrink-0 pt-px text-xs tabular-nums text-[#6F6A60] group-hover:text-[#1D4ED8]">p. {h.page_number}</span>
                        <Snippet text={h.snippet} />
                      </button>
                    </li>
                  ))}
                </ul>
                {g.hits.length > 4 && <p className="mt-1 pl-[68px] text-xs text-[#6F6A60]">and {g.hits.length - 4} more pages</p>}
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
