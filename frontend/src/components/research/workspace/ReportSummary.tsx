import { Loader2 } from 'lucide-react';
import type { ParsedReport } from '../../../types/researchLibrary';

interface ReportSummaryProps {
  parsed: ParsedReport;
  status: string;
  /** Moves the preview beside it to a page the summary cites. */
  onJumpToPage: (page: number) => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 first:mt-0">
      <h3 className="text-[13px] font-semibold text-[#1C1B17]">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

/** A list in the report's own words. `mark` is the one colour the list carries, if any. */
function Points({ items, mark }: { items: string[]; mark?: string }) {
  return (
    <ul className="space-y-2">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-[#1C1B17]">
          <span aria-hidden className="mt-[0.6em] h-1 w-1 shrink-0 rounded-full" style={{ background: mark ?? '#8B857A' }} />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

const nonEmpty = (a?: unknown[]): a is unknown[] => !!a && a.length > 0;

/** The parsed report, read top to bottom: the takeaway, then why, then what could go wrong. */
export default function ReportSummary({ parsed: p, status, onJumpToPage }: ReportSummaryProps) {
  if (status === 'failed') {
    return <p className="text-sm text-[#B23B2A]">This report could not be processed, so there is no AI summary. The PDF is still readable.</p>;
  }
  if (status !== 'parsed') {
    return (
      <p className="flex items-center gap-2 text-sm text-[#6F6A60]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Still {status}. The summary appears here when reading finishes; the list refreshes on its own.
      </p>
    );
  }

  const risks = nonEmpty(p.three_risks) ? p.three_risks : p.risks;
  const catalysts = nonEmpty(p.three_catalysts) ? p.three_catalysts : p.catalysts;

  return (
    <div>
      {p.summary_sentence && (
        <p className="text-[17px] font-medium leading-snug text-[#1C1B17]">{p.summary_sentence}</p>
      )}
      {p.one_paragraph_thesis && (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#1C1B17]">{p.one_paragraph_thesis}</p>
      )}

      <div className="mt-6">
        {nonEmpty(p.three_key_insights) && <Section title="Key insights"><Points items={p.three_key_insights} mark="#1D4ED8" /></Section>}
        {nonEmpty(risks) && <Section title="Risks"><Points items={risks} mark="#B23B2A" /></Section>}
        {nonEmpty(catalysts) && <Section title="Catalysts"><Points items={catalysts} mark="#2F8F5B" /></Section>}
        {nonEmpty(p.three_actionables) && <Section title="What to do with it"><Points items={p.three_actionables} /></Section>}
        {p.sector_outlook && <Section title="Sector outlook"><p className="text-sm leading-relaxed text-[#1C1B17]">{p.sector_outlook}</p></Section>}
        {p.valuation_summary && <Section title="Valuation"><p className="text-sm leading-relaxed text-[#1C1B17]">{p.valuation_summary}</p></Section>}

        {nonEmpty(p.company_ratings) && (
          <Section title="Ratings in this report">
            <table className="w-full text-sm">
              <tbody>
                {p.company_ratings.map((r, i) => (
                  <tr key={i} className="border-t border-[#E4DDCC] align-top first:border-t-0">
                    <td className="py-2 pr-3 font-medium text-[#1C1B17]">{r.company}</td>
                    <td className="py-2 pr-3 whitespace-nowrap font-semibold text-[#1C1B17]">{r.rating}</td>
                    <td className="py-2 text-[#6F6A60]">{r.rationale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {nonEmpty(p.price_forecasts) && (
          <Section title="Forecasts">
            <ul className="space-y-1.5 text-sm">
              {p.price_forecasts.map((f, i) => (
                <li key={i} className="text-[#1C1B17]"><span className="font-medium">{f.asset}</span> <span className="text-[#6F6A60]">— {f.forecast}, {f.timeframe}</span></li>
              ))}
            </ul>
          </Section>
        )}

        {nonEmpty(p.regulatory_changes) && <Section title="Regulatory changes"><Points items={p.regulatory_changes} /></Section>}

        {nonEmpty(p.citations) && (
          <Section title="Quoted from the report">
            <ul className="space-y-3">
              {p.citations.map((c, i) => (
                <li key={i} className="text-sm">
                  <blockquote className="border-l-2 border-[#D7D0C2] pl-3 text-[#1C1B17]">{c.text}</blockquote>
                  {c.page > 0 && (
                    <button onClick={() => onJumpToPage(c.page)} className="mt-1 pl-3 text-xs text-[#1D4ED8] hover:underline">
                      Show page {c.page}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </div>
  );
}
