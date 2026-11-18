// Finds where a citation's quote really sits in a report's stored page text.
//
// Gemini's quotes are meant to be verbatim but are often slightly reworded, and File Search
// does not say which page a passage came from. Matching the quote's word runs against the
// page text gives the true page and the report's own wording. Pure functions, no Deno APIs.

export interface PageText {
  page_number: number;
  content: string;
}

export interface LocatedExcerpt {
  page: number;
  /** The report's own text around the match, whitespace collapsed. */
  passage: string;
  /** [start, end) of the matched words inside `passage`. */
  hit: [number, number];
  /** Share of the quote's word runs found on the page, 0..1. */
  score: number;
}

const RUN = 4; // words per run; shorter quotes use their own length
const MIN_WORDS = 3; // fewer than this is too weak to place
const MIN_SCORE = 0.5;
const CONTEXT_CHARS = 140;

interface Word {
  w: string;
  start: number;
  end: number;
}

function wordsOf(text: string): Word[] {
  const out: Word[] = [];
  for (const m of text.matchAll(/[A-Za-z0-9]+/g)) {
    out.push({ w: m[0].toLowerCase(), start: m.index!, end: m.index! + m[0].length });
  }
  return out;
}

const collapse = (s: string) => s.replace(/\s+/g, ' ');

export function locateExcerpt(excerpt: string, pages: PageText[]): LocatedExcerpt | null {
  const ew = wordsOf(excerpt);
  if (ew.length < MIN_WORDS) return null;
  const n = Math.min(RUN, ew.length);

  const grams = new Set<string>();
  for (let i = 0; i + n <= ew.length; i++) grams.add(ew.slice(i, i + n).map((x) => x.w).join(' '));

  let best: { page: PageText; pw: Word[]; at: number[]; score: number } | null = null;
  for (const page of pages) {
    const pw = wordsOf(page.content);
    const at: number[] = [];
    const seen = new Set<string>();
    for (let i = 0; i + n <= pw.length; i++) {
      const gram = pw.slice(i, i + n).map((x) => x.w).join(' ');
      if (grams.has(gram)) {
        at.push(i);
        seen.add(gram);
      }
    }
    const score = seen.size / grams.size;
    if (at.length > 0 && (!best || score > best.score)) best = { page, pw, at, score };
  }
  if (!best || best.score < MIN_SCORE) return null;

  // A common phrase can match far from the real passage; keep the densest cluster of hits.
  const span = Math.ceil(ew.length * 1.5);
  let cluster: number[] = [];
  for (const i of best.at) {
    const inWindow = best.at.filter((j) => j >= i && j < i + span);
    if (inWindow.length > cluster.length) cluster = inWindow;
  }
  const first = best.pw[cluster[0]];
  const last = best.pw[cluster[cluster.length - 1] + n - 1];

  const text = best.page.content;
  let from = Math.max(0, first.start - CONTEXT_CHARS);
  let to = Math.min(text.length, last.end + CONTEXT_CHARS);
  // Don't start or end mid-word.
  if (from > 0) { const sp = text.indexOf(' ', from); if (sp !== -1 && sp < first.start) from = sp + 1; }
  if (to < text.length) { const sp = text.lastIndexOf(' ', to); if (sp > last.end) to = sp; }

  const pre = collapse(text.slice(from, first.start)).replace(/^ /, '');
  const mid = collapse(text.slice(first.start, last.end));
  const post = collapse(text.slice(last.end, to)).replace(/ $/, '');
  return {
    page: best.page.page_number,
    passage: pre + mid + post,
    hit: [pre.length, pre.length + mid.length],
    score: best.score,
  };
}
