import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, FileText, MessageSquarePlus } from 'lucide-react';
import MarkdownAnswer from '../MarkdownAnswer';
import GraphRenderer from '../GraphRenderer';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../ui/collapsible';
import type { ChatCitation, ChatReport, ResearchMessage } from '../../../types/researchChat';

interface ChatMessageProps {
  message: ResearchMessage;
  onAskAboutReport: (report: ChatReport) => void;
  /** Opens a report (at a page) beside the conversation. */
  onOpenReport: (reportId: string, page?: number) => void;
}

interface SourceCard {
  report: ChatReport;
  pages: number[];
}

/** One card per report the answer drew on, with the pages it quoted, in citation order. */
function sourceCards(citations: ChatCitation[], reports: ChatReport[]): SourceCard[] {
  const byId = new Map<string, SourceCard>();
  for (const c of citations) {
    if (!c.report_id) continue;
    const card = byId.get(c.report_id) ?? {
      report: reports.find((r) => r.id === c.report_id) ?? { id: c.report_id, title: c.title || c.source || 'Report' },
      pages: [],
    };
    if (c.page && !card.pages.includes(c.page)) card.pages.push(c.page);
    byId.set(c.report_id, card);
  }
  for (const r of reports) if (!byId.has(r.id)) byId.set(r.id, { report: r, pages: [] });
  return [...byId.values()];
}

export default function ChatMessage({ message, onAskAboutReport, onOpenReport }: ChatMessageProps) {
  const [quotesOpen, setQuotesOpen] = useState(false);
  const reduce = useReducedMotion();

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-[#1C1B17]/[0.07] px-4 py-2.5 text-sm text-[#1C1B17]">
          {message.content}
        </div>
      </div>
    );
  }

  const r = message.response;
  const citations = r?.citations ?? [];
  const cards = sourceCards(citations, r?.relevant_reports ?? []);
  const idPrefix = `${message.id}-`;

  return (
    <div className="text-sm text-[#1C1B17]">
      {cards.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-xs text-[#6F6A60]">Read {cards.length} report{cards.length === 1 ? '' : 's'}</p>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {cards.map((c, i) => (
              <motion.div
                key={c.report.id}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.3 }}
                className="group flex w-[200px] shrink-0 flex-col rounded-lg border border-[#E4DDCC] bg-[#FBF7ED] p-2.5 transition-colors hover:border-[#1D4ED8]/40"
              >
                <button onClick={() => onOpenReport(c.report.id, c.pages[0])} className="flex min-w-0 items-start gap-1.5 text-left">
                  <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8B857A] group-hover:text-[#1D4ED8]" />
                  <span className="line-clamp-2 text-xs font-medium leading-snug text-[#1C1B17]">{c.report.title}</span>
                </button>
                <div className="mt-auto flex items-center gap-1 pt-2 text-[11px] text-[#6F6A60]">
                  {c.pages.slice(0, 4).map((p) => (
                    <button key={p} onClick={() => onOpenReport(c.report.id, p)} className="rounded px-1 tabular-nums hover:bg-[#1D4ED8]/10 hover:text-[#1D4ED8]">p.{p}</button>
                  ))}
                  <button
                    onClick={() => onAskAboutReport(c.report)}
                    title="Ask a follow-up about this report only"
                    aria-label={`Ask about ${c.report.title} only`}
                    className="ml-auto rounded p-0.5 hover:bg-[#1D4ED8]/10 hover:text-[#1D4ED8]"
                  >
                    <MessageSquarePlus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <MarkdownAnswer content={message.content} citations={citations} idPrefix={idPrefix} onCitationClick={onOpenReport} />

      {r?.graphs?.map((graph, i) => <GraphRenderer key={i} graph={graph} />)}

      {r?.missing_info && r.missing_info.length > 0 && (
        <p className="mt-2 text-xs text-[#6F6A60]">Not in the reports: {r.missing_info.join('; ')}</p>
      )}

      {citations.length > 0 && (
        <Collapsible open={quotesOpen} onOpenChange={setQuotesOpen} className="mt-2">
          <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-[#6F6A60] hover:text-[#1C1B17]">
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${quotesOpen ? 'rotate-180' : ''}`} />
            {citations.length} quoted passage{citations.length === 1 ? '' : 's'}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2">
            {citations.map((c, i) => (
              <div key={i} id={`${idPrefix}citation-ref-${i + 1}`} className="rounded-lg bg-[#1C1B17]/[0.04] p-2.5 text-xs">
                <button
                  disabled={!c.report_id}
                  onClick={() => c.report_id && onOpenReport(c.report_id, c.page)}
                  className="text-left font-semibold text-[#1C1B17] enabled:hover:text-[#1D4ED8]"
                >
                  [{i + 1}] {c.title || c.source || 'Report'}{c.page ? ` · p.${c.page}` : ''}
                </button>
                {c.passage && c.passage_hit ? (
                  <p className="mt-1 text-[#1C1B17]">
                    …{c.passage.slice(0, c.passage_hit[0])}
                    <mark className="rounded-sm bg-[#FDE68A] px-0.5 text-[#1C1B17]">{c.passage.slice(c.passage_hit[0], c.passage_hit[1])}</mark>
                    {c.passage.slice(c.passage_hit[1])}…
                  </p>
                ) : (
                  <p className="mt-1 italic text-[#1C1B17]">“{c.excerpt}”</p>
                )}
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
