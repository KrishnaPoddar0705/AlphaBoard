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
