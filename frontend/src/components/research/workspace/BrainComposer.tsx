import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { ArrowUp, FileText, Library, Loader2, X } from 'lucide-react';
import type { ChatReport } from '../../../types/researchChat';

const MAX_CHIPS = 3;

interface BrainComposerProps {
  orgName: string;
  totalReports: number;
  scope: ChatReport[];
  onRemoveScope: (id: string) => void;
  onClearScope: () => void;
  onSend: (question: string) => void;
  busy: boolean;
  suggestions: string[];
  onFocus?: () => void;
  autoFocus?: boolean;
}

/**
 * Typewriter for the idle ghost: types a suggestion, holds it, moves to the next.
 * Returns the full first suggestion when motion is reduced or when paused.
 */
function useGhostTypewriter(suggestions: string[], paused: boolean) {
  const reduce = useReducedMotion();
  const [idx, setIdx] = useState(0);
  const [len, setLen] = useState(0);
  const current = suggestions[idx % Math.max(suggestions.length, 1)] ?? '';

  // Start over when the suggestions change (another report opened, the scope changed).
  const [seen, setSeen] = useState(suggestions);
  if (seen !== suggestions) { setSeen(suggestions); setIdx(0); setLen(0); }
  useEffect(() => {
    if (reduce || paused || !current) return;
    const done = len >= current.length;
    const t = setTimeout(() => {
      if (done) { setIdx((i) => i + 1); setLen(0); } else setLen((l) => l + 1);
    }, done ? 2600 : 28 + Math.random() * 40);
    return () => clearTimeout(t);
  }, [len, current, paused, reduce]);

  if (reduce || paused) return { text: current, typing: false, full: current };
  return { text: current.slice(0, len), typing: len < current.length, full: current };
}

export default function BrainComposer(props: BrainComposerProps) {
  const { orgName, scope, busy, suggestions } = props;
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  const ghost = useGhostTypewriter(suggestions, focused);
  // While typing, the ghost completes the first suggestion that starts with what is typed.
  const completion = text
    ? suggestions.find((s) => s.toLowerCase().startsWith(text.toLowerCase()) && s.length > text.length)?.slice(text.length) ?? ''
    : '';
  const ghostRest = text ? completion : ghost.text;
  const acceptable = text ? completion : ghost.full;

  useEffect(() => { if (props.autoFocus) ref.current?.focus(); }, [props.autoFocus]);

  // Grow with the question, up to about six lines.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [text]);

  const submit = () => {
    const q = text.trim();
    if (!q || busy) return;
    props.onSend(q);
    setText('');
  };

  return (
    <div className="rounded-[22px] border border-[#D7D0C2] bg-[#FBF7ED] shadow-[0_10px_30px_-12px_rgba(28,27,23,0.28)] transition-colors focus-within:border-[#1C1B17]/40">
      <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3 text-xs">
        {scope.length === 0 ? (
          <span className="inline-flex items-center gap-1.5 text-[#6F6A60]">
            <Library className="h-3.5 w-3.5" /> Searching all {props.totalReports} report{props.totalReports === 1 ? '' : 's'}
            <span className="hidden text-[#8B857A] sm:inline">· tick reports in the folders to narrow it</span>
          </span>
        ) : (
          <>
            {scope.slice(0, MAX_CHIPS).map((r) => (
              <span key={r.id} className="inline-flex max-w-[220px] items-center gap-1 rounded-full bg-[#1D4ED8]/10 py-0.5 pl-2 pr-1 text-[#1D4ED8]">
                <FileText className="h-3 w-3 shrink-0" />
                <span className="truncate">{r.title}</span>
                <button onClick={() => props.onRemoveScope(r.id)} aria-label={`Stop asking about ${r.title}`} className="rounded-full p-0.5 hover:bg-[#1D4ED8]/15"><X className="h-3 w-3" /></button>
              </span>
            ))}
            {scope.length > MAX_CHIPS && <span className="text-[#6F6A60]">+{scope.length - MAX_CHIPS} more</span>}
            <button onClick={props.onClearScope} className="text-[#6F6A60] underline-offset-2 hover:text-[#1C1B17] hover:underline">Use all reports</button>
          </>
        )}
      </div>

      <div className="flex items-end gap-2 px-2 pb-2 pl-4">
        <div className="relative min-w-0 flex-1 py-2">
          {/* The ghost layer sits exactly under the textarea and repeats its text invisibly. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words py-2 text-base leading-6 md:text-[15px]">
            <span className="invisible">{text}</span>
            <span className="text-[#A39D90]">{ghostRest}</span>
            {!text && !focused && ghost.typing && <span className="ml-px inline-block h-[1.05em] w-[2px] translate-y-[3px] animate-pulse bg-[#1D4ED8]" />}
            {acceptable && (focused || text) && (
              <kbd className="ml-2 rounded border border-[#D7D0C2] px-1 text-[10px] text-[#8B857A]">Tab</kbd>
            )}
          </div>
          <textarea
            ref={ref}
            rows={1}
            value={text}
            aria-label={`Ask ${orgName} Brain`}
            placeholder={ghostRest ? '' : `Ask ${orgName} Brain…`}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => { setFocused(true); props.onFocus?.(); }}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Tab' && !e.shiftKey && acceptable) {
                e.preventDefault();
                setText(text + (text ? completion : ghost.full));
              } else if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            className="relative block w-full resize-none bg-transparent text-base leading-6 text-[#1C1B17] placeholder:text-[#8B857A] focus:outline-none md:text-[15px]"
          />
        </div>
        <button
          onClick={submit}
          disabled={busy || !text.trim()}
          aria-label="Ask"
          className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1C1B17] text-[#FBF7ED] transition-transform hover:scale-105 active:scale-95 disabled:bg-[#1C1B17]/25 disabled:hover:scale-100"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
