import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import ChatMessage from './ChatMessage';
import type { ChatReport, ResearchMessage } from '../../../types/researchChat';

const STEPS = ['Understanding the question', 'Searching the reports', 'Ranking the evidence', 'Drafting the answer'];

interface ChatThreadProps {
  messages: ResearchMessage[];
  loading: boolean;
  pendingQuestion: string | null;
  /** The reports the pending question is limited to; empty means all of them. */
  pendingScope: ChatReport[];
  totalReports: number;
  error: string | null;
  onRetry: () => void;
  examples: string[];
  onExample: (q: string) => void;
  onAskAboutReport: (report: ChatReport) => void;
  onOpenReport: (reportId: string, page?: number) => void;
}

/** The pipeline's stages, ticked off as time passes; the call itself reports no progress. */
function Working({ scope, total }: { scope: ChatReport[]; total: number }) {
  const [i, setI] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    const t = setInterval(() => setI((n) => Math.min(n + 1, STEPS.length - 1)), 5000);
    return () => clearInterval(t);
  }, []);
  const where = scope.length === 0 ? `all ${total} reports` : scope.length === 1 ? scope[0].title : `${scope.length} selected reports`;
  return (
    <div role="status" className="space-y-1.5 text-sm">
      {STEPS.slice(0, i + 1).map((s, n) => (
        <motion.p
          key={s}
          initial={reduce ? false : { opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          className={`flex items-center gap-2 ${n < i ? 'text-[#6F6A60]' : 'text-[#1C1B17]'}`}
        >
          {n < i ? <Check className="h-3.5 w-3.5 text-[#2F8F5B]" /> : <Loader2 className="h-3.5 w-3.5 animate-spin text-[#1D4ED8]" />}
          {s}{n === 1 && <span className="truncate text-[#6F6A60]"> in {where}</span>}
        </motion.p>
      ))}
    </div>
  );
}

export default function ChatThread({
  messages, loading, pendingQuestion, pendingScope, totalReports, error, onRetry, examples, onExample, onAskAboutReport, onOpenReport,
}: ChatThreadProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, pendingQuestion, error]);

  const empty = !loading && messages.length === 0 && !pendingQuestion;

  return (
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-5">
      {loading && <p className="flex items-center gap-2 text-sm text-[#6F6A60]"><Loader2 className="h-4 w-4 animate-spin" />Loading the conversation…</p>}

      {empty && (
        <div className="pt-4">
          <p className="text-sm text-[#1C1B17]">Ask anything the reports might answer. Follow-ups keep the context; conversations are private to you.</p>
          <ul className="mt-3 space-y-1">
            {examples.slice(0, 4).map((q) => (
              <li key={q}>
                <button onClick={() => onExample(q)} className="w-full rounded-md px-2 py-1.5 text-left text-sm text-[#1C1B17] hover:bg-[#1D4ED8]/[0.07] hover:text-[#1D4ED8]">{q}</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {messages.map((m) => (
        <ChatMessage key={m.id} message={m} onAskAboutReport={onAskAboutReport} onOpenReport={onOpenReport} />
      ))}

      <AnimatePresence>
        {pendingQuestion && (
          <motion.div key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex justify-end">
              <div className="max-w-[88%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-[#1C1B17]/[0.07] px-4 py-2.5 text-sm text-[#1C1B17]">
                {pendingQuestion}
              </div>
            </div>
            {error ? (
              <p className="text-sm text-[#B23B2A]">
                {error} <button onClick={onRetry} className="font-semibold underline">Try again</button>
              </p>
            ) : (
              <Working scope={pendingScope} total={totalReports} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <div ref={endRef} />
    </div>
  );
}
