import type { ResearchConversation } from '../types/researchChat';

export interface ConversationGroup {
  label: string;
  items: ResearchConversation[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Group threads (already newest first) under Today / Yesterday / Previous 7 days / Earlier. */
export function groupConversations(items: ResearchConversation[], now: Date = new Date()): ConversationGroup[] {
  const today = startOfDay(now);
  const buckets: ConversationGroup[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Previous 7 days', items: [] },
    { label: 'Earlier', items: [] },
  ];
  for (const item of items) {
    const age = today - startOfDay(new Date(item.updated_at));
    const bucket = age <= 0 ? 0 : age <= DAY_MS ? 1 : age <= 7 * DAY_MS ? 2 : 3;
    buckets[bucket].items.push(item);
  }
  return buckets.filter((b) => b.items.length > 0);
}

/** A thread title from its first question: one line, trimmed to `max` characters. */
export function deriveTitle(question: string, max = 60): string {
  const oneLine = question.replace(/\s+/g, ' ').trim();
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max - 1).trimEnd()}…`;
}

/** "2 hours ago", "Yesterday", "3 Oct": how Claude labels a conversation's last message. */
export function lastActive(iso: string, now = Date.now()): string {
  const mins = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

const LEAD_WORDS = new Set([
  'hey', 'hi', 'please', 'can', 'could', 'would', 'you', 'tell', 'me', 'give', 'show', 'what', 'whats', "what's",
  'how', 'much', 'many', 'why', 'which', 'who', 'when', 'where', 'is', 'are', 'was', 'were', 'does', 'do', 'did',
  'the', 'a', 'an', 'our', 'there', 'any', 'about',
]);
const TRAILING_WORDS = new Set(['at', 'in', 'on', 'for', 'of', 'to', 'by', 'with', 'about', 'and', 'or', 'the', 'a', 'an']);
const ARTICLES = new Set(['the', 'a', 'an', 'our']);
const MAX_WORDS = 5;

/**
 * A short label for a conversation, Claude-style, from its stored title (usually the first
 * question): "how much is the Commercial refrigeration valued at?" → "Commercial refrigeration valued".
 * Display only; the saved title is untouched, and a title that is already short passes through.
 */
export function shortChatTitle(title: string): string {
  const cleaned = title
    .replace(/[?!.]+$/g, '')
    .replace(/\b(across|in|from)\s+((all|our|the|research)\s+)*reports?\b/gi, '')
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  while (words.length > 1 && LEAD_WORDS.has(words[0].toLowerCase())) words.shift();
  const kept = words.filter((w, i) => i === 0 || !ARTICLES.has(w.toLowerCase())).slice(0, MAX_WORDS);
  while (kept.length > 1 && TRAILING_WORDS.has(kept[kept.length - 1].toLowerCase())) kept.pop();
  const short = kept.join(' ');
  if (!short) return title;
  return short[0].toUpperCase() + short.slice(1);
}
