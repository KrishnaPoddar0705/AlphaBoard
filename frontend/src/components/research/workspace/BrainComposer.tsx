import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { ArrowUp, FileText, Library, Loader2, Search, Sparkles, X } from 'lucide-react';
import type { ChatReport } from '../../../types/researchChat';

const MAX_CHIPS = 3;

export type ComposerMode = 'ask' | 'search';

interface BrainComposerProps {
  orgName: string;
  totalReports: number;
  scope: ChatReport[];
  onRemoveScope: (id: string) => void;
  onClearScope: () => void;
  onSend: (question: string) => void;
  busy: boolean;
  suggestions: string[];
  /** Ask sends a question to the Brain; Search filters titles and report text as you type. */
  mode: ComposerMode;
  onMode: (m: ComposerMode) => void;
  /** The search words, owned by the page because the results show in the centre. */
  query: string;
  onQuery: (q: string) => void;
  searching: boolean;
  /** Changes to this number focus the input (the "/" shortcut). */
  focusSignal?: number;
  autoFocus?: boolean;
}

/**
 * Typewriter for the idle ghost: types a suggestion, holds it, moves to the next.
 * Returns the full suggestion when motion is reduced or when paused.
 */
function useGhostTypewriter(suggestions: string[], paused: boolean) {
  const reduce = useReducedMotion();
  const [idx, setIdx] = useState(0);
  const [len, setLen] = useState(0);
  // Start over when the suggestions change (another report opened, the scope changed).
  const [seen, setSeen] = useState(suggestions);
  if (seen !== suggestions) { setSeen(suggestions); setIdx(0); setLen(0); }
  const current = suggestions[idx % Math.max(suggestions.length, 1)] ?? '';

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

const MODES: Array<{ id: ComposerMode; label: string; Icon: typeof Search }> = [
  { id: 'ask', label: 'Ask', Icon: Sparkles },
  { id: 'search', label: 'Search', Icon: Search },
];

export default function BrainComposer(props: BrainComposerProps) {
  const { orgName, scope, busy, suggestions, mode } = props;
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const searchMode = mode === 'search';
  const text = searchMode ? props.query : draft;
  const setText = searchMode ? props.onQuery : setDraft;

  const ghost = useGhostTypewriter(suggestions, focused || searchMode);
  // While typing a question, the ghost completes the first suggestion that starts with it.
  const completion = !searchMode && text
    ? suggestions.find((s) => s.toLowerCase().startsWith(text.toLowerCase()) && s.length > text.length)?.slice(text.length) ?? ''
    : '';
  const ghostRest = searchMode ? '' : text ? completion : ghost.text;
  const acceptable = searchMode ? '' : text ? completion : ghost.full;

  useEffect(() => { if (props.autoFocus) ref.current?.focus(); }, [props.autoFocus]);
  useEffect(() => { if (props.focusSignal) ref.current?.focus(); }, [props.focusSignal]);

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
    // In Search mode the button hands the same words to the Brain as a question.
    if (searchMode) { props.onMode('ask'); props.onQuery(''); }
    else setDraft('');
    props.onSend(q);
  };

  const switchMode = (m: ComposerMode) => {
    if (m === mode) return;
    // Carry what is typed across, so a search can become a question and back.
    if (m === 'search') { props.onQuery(draft); setDraft(''); } else { setDraft(props.query); props.onQuery(''); }
    props.onMode(m);
    ref.current?.focus();
  };

  return (
    <div className="rounded-[22px] border border-[#D7D0C2] bg-[#FBF7ED] shadow-[0_10px_30px_-12px_rgba(28,27,23,0.28)] transition-colors focus-within:border-[#1C1B17]/40">
      <div className="relative px-4 pb-1 pt-3">
        {/* The ghost layer sits exactly under the textarea and repeats its text invisibly. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-4 bottom-1 top-3 overflow-hidden whitespace-pre-wrap break-words text-base leading-6 md:text-[15px]">
          <span className="invisible">{text}</span>
          <span className="text-[#A39D90]">{ghostRest}</span>
          {!text && !focused && ghost.typing && <span className="ml-px inline-block h-[1.05em] w-[2px] translate-y-[3px] animate-pulse bg-[#1D4ED8]" />}
          {acceptable && (focused || text) && <kbd className="ml-2 rounded border border-[#D7D0C2] px-1 text-[10px] text-[#8B857A]">Tab</kbd>}
        </div>
        <textarea
          ref={ref}
          rows={1}
          value={text}
          aria-label={searchMode ? 'Search reports' : `Ask ${orgName} Brain`}
          placeholder={ghostRest ? '' : searchMode ? 'Search titles and every page, typos allowed' : `Ask ${orgName} Brain…`}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Tab' && !e.shiftKey && acceptable) {
              e.preventDefault();
              setText(text + acceptable);
            } else if (e.key === 'Escape' && searchMode) {
              props.onQuery('');
            } else if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (!searchMode) submit();
            }
          }}
          className="relative block w-full resize-none border-0 bg-transparent p-0 text-base leading-6 text-[#1C1B17] placeholder:text-[#8B857A] focus:outline-none focus-visible:[box-shadow:none] md:text-[15px]"
        />
      </div>

      <div className="flex items-center gap-2 px-2 pb-2 pl-3">
        <div role="radiogroup" aria-label="Composer mode" className="flex shrink-0 rounded-full bg-[#1C1B17]/[0.05] p-0.5 text-xs">
          {MODES.map(({ id, label, Icon }) => (
            <button
              key={id}
              role="radio"
              aria-checked={mode === id}
              onClick={() => switchMode(id)}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors ${mode === id ? 'bg-[#FBF7ED] font-medium text-[#1C1B17] shadow-[0_1px_2px_rgba(28,27,23,0.12)]' : 'text-[#6F6A60] hover:text-[#1C1B17]'}`}
            >
              <Icon className="h-3.5 w-3.5" />{label}
            </button>
          ))}
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-xs">
          {searchMode ? (
            <span className="truncate text-[#6F6A60]">
              {props.searching ? <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> : null}
              {text.trim() ? 'Results update as you type · Esc to clear' : `Find a report or a phrase in all ${props.totalReports}`}
            </span>
          ) : scope.length === 0 ? (
            <span className="inline-flex min-w-0 items-center gap-1.5 text-[#6F6A60]">
              <Library className="h-3.5 w-3.5 shrink-0" /><span className="truncate">All {props.totalReports} report{props.totalReports === 1 ? '' : 's'}</span>
            </span>
          ) : (
            <>
              {scope.slice(0, MAX_CHIPS).map((r) => (
                <span key={r.id} className="inline-flex max-w-[200px] items-center gap-1 rounded-full bg-[#1D4ED8]/10 py-0.5 pl-2 pr-1 text-[#1D4ED8]">
                  <FileText className="h-3 w-3 shrink-0" />
                  <span className="truncate">{r.title}</span>
                  <button onClick={() => props.onRemoveScope(r.id)} aria-label={`Stop asking about ${r.title}`} className="rounded-full p-0.5 hover:bg-[#1D4ED8]/15"><X className="h-3 w-3" /></button>
                </span>
              ))}
              {scope.length > MAX_CHIPS && <span className="text-[#6F6A60]">+{scope.length - MAX_CHIPS}</span>}
              <button onClick={props.onClearScope} className="text-[#6F6A60] underline-offset-2 hover:text-[#1C1B17] hover:underline">All reports</button>
            </>
          )}
        </div>

        <button
          onClick={submit}
          disabled={busy || !text.trim()}
          aria-label={searchMode ? 'Ask the Brain about these words' : 'Ask'}
          title={searchMode ? 'Ask the Brain about these words' : undefined}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1C1B17] text-[#FBF7ED] transition-transform hover:scale-105 active:scale-95 disabled:bg-[#1C1B17]/25 disabled:hover:scale-100"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : searchMode ? <Sparkles className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
