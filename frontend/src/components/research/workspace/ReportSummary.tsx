import { useState } from 'react';
import { AlertTriangle, BarChart3, FileText, Lightbulb, Loader2, Quote, TrendingUp } from 'lucide-react';
import type { ParsedReport } from '../../../types/researchLibrary';

interface ReportSummaryProps {
  parsed: ParsedReport;
  status: string;
  /** Moves the preview beside it to a page the summary cites. */
  onJumpToPage: (page: number) => void;
}

const TABS = [
  { id: 'summary', label: 'Summary', Icon: FileText },
  { id: 'insights', label: 'Insights', Icon: Lightbulb },
  { id: 'risks', label: 'Risks', Icon: AlertTriangle },
  { id: 'catalysts', label: 'Catalysts', Icon: TrendingUp },
  { id: 'financials', label: 'Financials', Icon: BarChart3 },
  { id: 'citations', label: 'Citations', Icon: Quote },
] as const;
type TabId = (typeof TABS)[number]['id'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 first:mt-0">
      <h3 className="text-[13px] font-semibold text-[#1C1B17]">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

/** A list in the report's own words. `mark` is the one colour the list carries, if any. */
function Points({ items, mark, numbered }: { items: string[]; mark?: string; numbered?: boolean }) {
  return (
    <ul className="space-y-2">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-[#1C1B17]">
          {numbered ? (
            <span className="w-4 shrink-0 font-semibold tabular-nums" style={{ color: mark ?? '#1C1B17' }}>{i + 1}.</span>
          ) : (
            <span aria-hidden className="mt-[0.6em] h-1 w-1 shrink-0 rounded-full" style={{ background: mark ?? '#8B857A' }} />
          )}
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

const Para = ({ children }: { children: React.ReactNode }) => (
  <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#1C1B17]">{children}</p>
);

/** A parsed financial table: rows of objects as a table, an object as label/value pairs. */
function TableData({ data }: { data: unknown }) {
  if (Array.isArray(data) && data.length > 0 && data.every((r) => r && typeof r === 'object' && !Array.isArray(r))) {
    const cols = [...new Set(data.flatMap((r) => Object.keys(r as object)))];
    return (
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr>{cols.map((c) => <th key={c} className="border-b border-[#D7D0C2] py-1.5 pr-3 text-left font-medium text-[#6F6A60]">{c}</th>)}</tr></thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={i}>{cols.map((c) => <td key={c} className="border-b border-[#E4DDCC] py-1.5 pr-3 tabular-nums text-[#1C1B17]">{String((r as Record<string, unknown>)[c] ?? '–')}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return (
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
        {Object.entries(data as Record<string, unknown>).map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-[#6F6A60]">{k}</dt>
            <dd className="tabular-nums text-[#1C1B17]">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return data ? <p className="mt-2 text-xs text-[#1C1B17]">{String(data)}</p> : null;
}

const has = (a?: unknown[]): a is unknown[] => !!a && a.length > 0;
const Empty = ({ what }: { what: string }) => <p className="text-sm text-[#6F6A60]">The report does not state any {what}.</p>;

/** The parsed report in the six tabs analysts know: summary through to the quoted passages. */
export default function ReportSummary({ parsed: p, status, onJumpToPage }: ReportSummaryProps) {
  const [tab, setTab] = useState<TabId>('summary');

  const pageLink = (page?: number) =>
    page && page > 0 ? (
      <button onClick={() => onJumpToPage(page)} className="text-xs text-[#1D4ED8] hover:underline">Page {page}</button>
    ) : null;

  let body: React.ReactNode;
  if (status === 'failed') {
    body = <p className="text-sm text-[#B23B2A]">This report could not be processed, so there is no AI summary. The PDF is still readable.</p>;
  } else if (status !== 'parsed') {
    body = (
      <p className="flex items-center gap-2 text-sm text-[#6F6A60]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Still {status}. The summary appears here when reading finishes; the list refreshes on its own.
      </p>
    );
  } else if (tab === 'summary') {
    body = !p.summary_sentence && !p.one_paragraph_thesis && !p.sector_outlook && !p.valuation_summary ? <Empty what="summary" /> : (
      <>
        {p.summary_sentence && <Section title="Key takeaway"><p className="text-[15px] font-medium leading-snug text-[#1C1B17]">{p.summary_sentence}</p></Section>}
        {p.one_paragraph_thesis && <Section title="Investment thesis"><Para>{p.one_paragraph_thesis}</Para></Section>}
        {p.sector_outlook && <Section title="Sector outlook"><Para>{p.sector_outlook}</Para></Section>}
        {p.valuation_summary && <Section title="Valuation"><Para>{p.valuation_summary}</Para></Section>}
      </>
    );
  } else if (tab === 'insights') {
    body = !has(p.three_key_insights) && !has(p.key_drivers) && !has(p.three_actionables) ? <Empty what="insights" /> : (
      <>
        {has(p.three_key_insights) && <Section title="Key insights"><Points items={p.three_key_insights} mark="#1D4ED8" numbered /></Section>}
        {has(p.key_drivers) && <Section title="Key drivers"><Points items={p.key_drivers} /></Section>}
        {has(p.three_actionables) && <Section title="Actionables"><Points items={p.three_actionables} mark="#2F8F5B" numbered /></Section>}
      </>
    );
  } else if (tab === 'risks') {
    body = !has(p.three_risks) && !has(p.risks) ? <Empty what="risks" /> : (
      <>
        {has(p.three_risks) && <Section title="Top risks"><Points items={p.three_risks} mark="#B23B2A" numbered /></Section>}
        {has(p.risks) && <Section title="All risks"><Points items={p.risks} mark="#B23B2A" /></Section>}
      </>
    );
  } else if (tab === 'catalysts') {
    body = !has(p.three_catalysts) && !has(p.catalysts) && !has(p.regulatory_changes) && !has(p.price_forecasts) ? <Empty what="catalysts" /> : (
      <>
        {has(p.three_catalysts) && <Section title="Top catalysts"><Points items={p.three_catalysts} mark="#2F8F5B" numbered /></Section>}
        {has(p.catalysts) && <Section title="All catalysts"><Points items={p.catalysts} mark="#2F8F5B" /></Section>}
        {has(p.regulatory_changes) && <Section title="Regulatory changes"><Points items={p.regulatory_changes} /></Section>}
        {has(p.price_forecasts) && (
          <Section title="Price forecasts">
            <ul className="space-y-1.5 text-sm">
              {p.price_forecasts.map((f, i) => (
                <li key={i} className="text-[#1C1B17]"><span className="font-medium">{f.asset}</span> <span className="text-[#6F6A60]">— {f.forecast}, {f.timeframe}</span></li>
              ))}
            </ul>
          </Section>
        )}
      </>
    );
  } else if (tab === 'financials') {
    body = !has(p.financial_tables) && !has(p.company_ratings) ? <Empty what="financial tables or ratings" /> : (
      <>
        {has(p.company_ratings) && (
          <Section title="Company ratings">
            <table className="w-full text-sm">
              <tbody>
                {p.company_ratings.map((r, i) => (
                  <tr key={i} className="border-t border-[#E4DDCC] align-top first:border-t-0">
                    <td className="py-2 pr-3 font-medium text-[#1C1B17]">{r.company}</td>
                    <td className="whitespace-nowrap py-2 pr-3 font-semibold text-[#1C1B17]">{r.rating}</td>
                    <td className="py-2 text-[#6F6A60]">{r.rationale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}
        {has(p.financial_tables) && (
          <Section title="Financial tables">
            <div className="space-y-5">
              {p.financial_tables.map((t, i) => (
                <div key={i}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium text-[#1C1B17]">{t.description}</p>
                    {pageLink(t.page)}
                  </div>
                  <TableData data={t.data} />
                </div>
              ))}
            </div>
          </Section>
        )}
      </>
    );
  } else {
    body = !has(p.citations) ? <Empty what="citations" /> : (
      <ul className="space-y-4">
        {p.citations.map((c, i) => (
          <li key={i} className="text-sm">
            <blockquote className="border-l-2 border-[#D7D0C2] pl-3 text-[#1C1B17]">{c.text}</blockquote>
            <div className="mt-1 flex items-center gap-2 pl-3 text-xs text-[#6F6A60]">
              {pageLink(c.page)}
              {c.source && <span>{c.source}</span>}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      {/* A small floating card of pills; the section text scrolls beneath it. */}
      <div className="sticky top-0 z-10 bg-[#F1EEE0] px-3 pb-1 pt-3">
        <div role="tablist" aria-label="AI summary" className="flex flex-wrap gap-1 rounded-2xl border border-[#E4DDCC] bg-[#FBF7ED] p-1.5 shadow-[0_6px_18px_-10px_rgba(28,27,23,0.35)]">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors active:scale-[0.97] ${tab === id ? 'bg-[#1C1B17] font-medium text-[#FBF7ED]' : 'text-[#6F6A60] hover:bg-[#1C1B17]/[0.06] hover:text-[#1C1B17]'}`}
            >
              <Icon className="h-3.5 w-3.5" />{label}
            </button>
          ))}
        </div>
      </div>
      <div role="tabpanel" className="px-4 pb-36 pt-4 md:px-5">{body}</div>
    </div>
  );
}
