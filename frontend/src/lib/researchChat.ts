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
