import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, FileText, MessageSquarePlus } from 'lucide-react';
import MarkdownAnswer from '../MarkdownAnswer';
import GraphRenderer from '../GraphRenderer';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../ui/collapsible';
import type { ChatReport, ResearchMessage } from '../../../types/researchChat';

interface ChatMessageProps {
  message: ResearchMessage;
  onAskAboutReport: (report: ChatReport) => void;
}

export default function ChatMessage({ message, onAskAboutReport }: ChatMessageProps) {
  const navigate = useNavigate();
  const [sourcesOpen, setSourcesOpen] = useState(false);

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[90%] md:max-w-[75%] rounded-2xl rounded-br-sm bg-[#1D4ED8] text-white px-4 py-2.5 text-sm whitespace-pre-wrap break-words">
          {message.content}
        </div>
      </div>
    );
  }

  const r = message.response;
  const citations = r?.citations ?? [];
  const reports = r?.relevant_reports ?? [];
  const idPrefix = `${message.id}-`;

  return (
    <div className="max-w-full md:max-w-[85%] rounded-2xl rounded-bl-sm border border-[#D7D0C2] bg-[#FBF7ED] px-4 py-3 text-sm">
      <MarkdownAnswer
        content={message.content}
        citations={citations}
        idPrefix={idPrefix}
        onCitationClick={(id) => navigate(`/research/${id}`)}
      />

      {r?.graphs?.map((graph, i) => <GraphRenderer key={i} graph={graph} />)}

      {r?.missing_info && r.missing_info.length > 0 && (
        <p className="mt-2 text-xs text-[#6F6A60]">Not found in the reports: {r.missing_info.join('; ')}</p>
      )}

      {(citations.length > 0 || reports.length > 0) && (
        <Collapsible open={sourcesOpen} onOpenChange={setSourcesOpen} className="mt-3 border-t border-[#D7D0C2] pt-2">
          <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-[#6F6A60] hover:text-[#1C1B17]">
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${sourcesOpen ? 'rotate-180' : ''}`} />
            Sources ({citations.length || reports.length})
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2">
            {citations.map((c, i) => (
              <div key={i} id={`${idPrefix}citation-ref-${i + 1}`} className="rounded-lg border border-[#D7D0C2] bg-[#F1EEE0] p-2.5 text-xs">
                <div className="font-semibold text-[#1D4ED8]">
                  [{i + 1}] {c.title || c.source || 'Report'}
                  {c.page && c.report_id ? (
                    <> · <Link to={`/research/${c.report_id}?page=${c.page}`} className="underline">Page {c.page}</Link></>
                  ) : c.page ? ` · p.${c.page}` : ''}
                </div>
                {c.passage && c.passage_hit ? (
                  <p className="mt-1 text-[#1C1B17]">
                    …{c.passage.slice(0, c.passage_hit[0])}
                    <mark className="bg-[#FDE68A] text-[#1C1B17] rounded px-0.5">{c.passage.slice(c.passage_hit[0], c.passage_hit[1])}</mark>
                    {c.passage.slice(c.passage_hit[1])}…
                  </p>
                ) : (
                  <p className="mt-1 text-[#1C1B17] italic">“{c.excerpt}”</p>
                )}
              </div>
            ))}
            {reports.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {reports.map((rep) => (
                  <span key={rep.id} className="inline-flex items-center rounded-full border border-[#D7D0C2] bg-white text-xs">
                    <button
                      onClick={() => navigate(`/research/${rep.id}`)}
                      className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 text-[#1D4ED8] hover:underline"
                    >
                      <FileText className="w-3 h-3" />{rep.title}
                    </button>
                    <button
                      onClick={() => onAskAboutReport(rep)}
                      title="Ask a follow-up about this report only"
                      aria-label={`Ask about ${rep.title}`}
                      className="pr-2 pl-1 py-1 text-[#6F6A60] hover:text-[#1D4ED8]"
                    >
                      <MessageSquarePlus className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
