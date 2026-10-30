import { useState } from 'react';
import { Loader2, Send, X } from 'lucide-react';
import type { ChatReport } from '../../../types/researchChat';

const MAX_CHIPS = 3; // a filter can select many reports; show a few and the count

interface ChatComposerProps {
  disabled: boolean;
  scope: ChatReport[];
  onRemoveScope: (id: string) => void;
  onClearScope: () => void;
  onSend: (question: string) => void;
}

export default function ChatComposer({ disabled, scope, onRemoveScope, onClearScope, onSend }: ChatComposerProps) {
  const [text, setText] = useState('');

  const submit = () => {
    const q = text.trim();
    if (!q || disabled) return;
    onSend(q);
    setText('');
  };

  return (
    <div className="border-t border-[#D7D0C2] bg-[#F1EEE0] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {scope.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[#6F6A60]">Only asking about:</span>
          {scope.slice(0, MAX_CHIPS).map((r) => (
            <span key={r.id} className="inline-flex items-center gap-1 rounded-full bg-[#1D4ED8]/10 px-2.5 py-1 text-[#1D4ED8]">
              {r.title}
              <button onClick={() => onRemoveScope(r.id)} aria-label={`Stop limiting to ${r.title}`}><X className="w-3 h-3" /></button>
            </span>
          ))}
          {scope.length > MAX_CHIPS && <span className="text-[#6F6A60]">+{scope.length - MAX_CHIPS} more</span>}
          {scope.length > 1 && (
            <button onClick={onClearScope} className="text-[#6F6A60] underline hover:text-[#1C1B17]">Clear</button>
          )}
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          disabled={disabled}
          placeholder="Ask a question about your research reports…"
          className="flex-1 resize-none rounded-xl border border-[#D7D0C2] bg-[#FBF7ED] px-3 py-2.5 text-base md:text-sm text-[#1C1B17] placeholder:text-[#6F6A60] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30 disabled:opacity-60 max-h-40"
        />
        <button
          onClick={submit}
          disabled={disabled || !text.trim()}
          aria-label="Send"
          className="h-11 w-11 shrink-0 rounded-xl bg-[#1D4ED8] text-white flex items-center justify-center disabled:opacity-50"
        >
          {disabled ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
