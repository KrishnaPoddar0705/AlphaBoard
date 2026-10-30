import { Link } from 'react-router-dom';
import { ArrowUpRight, FileText, Loader2 } from 'lucide-react';
import { Card, CardContent } from '../ui/card-new';
import { groupByReport, splitSnippet, type KeywordHit } from '../../lib/researchSearch';
import { getUserFriendlyError } from '../../lib/errorSanitizer';

interface ReportTextMatchesProps {
  query: string;
  loading: boolean;
  error: unknown;
  hits: KeywordHit[] | undefined;
  /** Say so when the filters left no reports to search, rather than "not found". */
  scopeEmpty: boolean;
}

/** The report page, opened at the hit page; `q` lets viewers that support it find the words. */
const pageLink = (reportId: string, page: number, q: string) =>
  `/research/${reportId}?page=${page}&q=${encodeURIComponent(q)}`;

function Snippet({ text }: { text: string }) {
  return (
    <p className="text-sm text-[#1C1B17] leading-relaxed">
      …{splitSnippet(text).map((p, i) =>
        p.hit ? <mark key={i} className="bg-[#FDE68A] text-[#1C1B17] rounded px-0.5">{p.text}</mark> : <span key={i}>{p.text}</span>,
      )}…
    </p>
  );
}

/** Where the search words appear inside report text, by report and page. */
export default function ReportTextMatches({ query, loading, error, hits, scopeEmpty }: ReportTextMatchesProps) {
  const groups = groupByReport(hits ?? []);

  return (
    <Card>
      <CardContent className="p-4 md:p-6 space-y-3">
        <h2 className="text-sm font-semibold text-[#1C1B17]">Matches inside report text</h2>

        {loading && <p className="flex items-center gap-2 text-sm text-[#6F6A60]"><Loader2 className="w-4 h-4 animate-spin" />Searching…</p>}
        {!!error && <p className="text-sm text-[#B23B2A]">{getUserFriendlyError(error)}</p>}

        {!loading && !error && scopeEmpty && (
          <p className="text-sm text-[#6F6A60]">No reports match the current filters, so there is nothing to search.</p>
        )}

        {!loading && !error && !scopeEmpty && hits && (
          groups.length === 0 ? (
            <p className="text-sm text-[#1C1B17]">
              <span className="font-semibold">Not found</span> in the text of any report in the current filters: “{query}”.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[#6F6A60]">
                Found in <span className="font-semibold text-[#1C1B17]">{groups.length}</span> report{groups.length !== 1 ? 's' : ''}
              </p>
              {groups.map((g) => (
                <div key={g.report_id} className="rounded-lg border border-[#D7D0C2] bg-[#FBF7ED] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Link to={`/research/${g.report_id}`} className="flex min-w-0 items-center gap-1.5 font-semibold text-sm text-[#1D4ED8] hover:underline">
                      <FileText className="w-4 h-4 shrink-0" /><span className="truncate">{g.title}</span>
                    </Link>
                    <span className="shrink-0 text-xs text-[#6F6A60]">{g.totalHits} page{g.totalHits !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="mt-2 space-y-2">
                    {g.hits.slice(0, 3).map((h) => (
                      <div key={h.page_number}>
                        <div className="flex items-center gap-1.5">
                          <Link to={pageLink(g.report_id, h.page_number, query)} className="text-xs font-medium text-[#6F6A60] hover:text-[#1D4ED8]">
                            Page {h.page_number}
                          </Link>
                          <a
                            href={pageLink(g.report_id, h.page_number, query)}
                            target="_blank"
                            rel="noreferrer"
                            title={`Open page ${h.page_number} in a new tab`}
                            aria-label={`Open ${g.title} page ${h.page_number} in a new tab`}
                            className="text-[#6F6A60] hover:text-[#1D4ED8]"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </a>
                        </div>
                        <Snippet text={h.snippet} />
                      </div>
                    ))}
                    {g.hits.length > 3 && <p className="text-xs text-[#6F6A60]">+{g.hits.length - 3} more pages in this report</p>}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}
