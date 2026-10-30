import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import ChatMessage from './ChatMessage';
import type { ChatReport, ResearchMessage } from '../../../types/researchChat';

const EXAMPLE_QUERIES = [
  'What are the key risks across all metals reports?',
  'Summarize the EPS growth outlook for IT Services sector',
  'What regulatory changes are mentioned in recent reports?',
  'Compare valuation multiples across healthcare companies',
];

const PROGRESS = ['Understanding your question…', 'Searching reports…', 'Ranking the evidence…', 'Drafting the answer…'];

interface ChatThreadProps {
  messages: ResearchMessage[];
  loading: boolean;
  pendingQuestion: string | null;
  error: string | null;
  onRetry: () => void;
  onExample: (q: string) => void;
  onAskAboutReport: (report: ChatReport) => void;
}

function Progress() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => Math.min(n + 1, PROGRESS.length - 1)), 6000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="inline-flex items-center gap-2 rounded-2xl border border-[#D7D0C2] bg-[#FBF7ED] px-4 py-3 text-sm text-[#6F6A60]">
      <Loader2 className="w-4 h-4 animate-spin" />{PROGRESS[i]}
    </div>
  );
}

export default function ChatThread({
  messages, loading, pendingQuestion, error, onRetry, onExample, onAskAboutReport,
}: ChatThreadProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, pendingQuestion, error]);

  const empty = !loading && messages.length === 0 && !pendingQuestion;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {loading && <div className="text-sm text-[#6F6A60]">Loading conversation…</div>}

      {empty && (
        <div className="max-w-xl mx-auto pt-8 text-center">
          <h2 className="text-lg font-semibold text-[#1C1B17]">Ask your research reports</h2>
          <p className="mt-1 text-sm text-[#6F6A60]">Ask a question, then keep going with follow-ups. Conversations are saved and private to you.</p>
          <div className="mt-4 grid gap-2">
            {EXAMPLE_QUERIES.map((q) => (
              <button key={q} onClick={() => onExample(q)} className="rounded-xl border border-[#D7D0C2] bg-[#FBF7ED] px-3 py-2 text-left text-sm text-[#1C1B17] hover:border-[#1D4ED8]/40">
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.map((m) => <ChatMessage key={m.id} message={m} onAskAboutReport={onAskAboutReport} />)}

      {pendingQuestion && (
        <>
          <div className="flex justify-end">
            <div className="max-w-[90%] md:max-w-[75%] rounded-2xl rounded-br-sm bg-[#1D4ED8] text-white px-4 py-2.5 text-sm whitespace-pre-wrap break-words">
              {pendingQuestion}
            </div>
          </div>
          {error ? (
            <div className="rounded-xl border border-[#B23B2A]/30 bg-[#B23B2A]/5 px-4 py-3 text-sm text-[#B23B2A]">
              {error}{' '}
              <button onClick={onRetry} className="font-semibold underline">Try again</button>
            </div>
          ) : (
            <Progress />
          )}
        </>
      )}
      <div ref={endRef} />
    </div>
  );
}
