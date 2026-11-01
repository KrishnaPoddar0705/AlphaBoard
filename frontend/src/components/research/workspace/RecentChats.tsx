import { useState } from 'react';
import { MessageSquare, Trash2 } from 'lucide-react';
import DeleteChatDialog from './DeleteChatDialog';
import { lastActive, shortChatTitle } from '../../../lib/researchChat';
import type { ResearchConversation } from '../../../types/researchChat';

const LIMIT = 6;

interface RecentChatsProps {
  conversations: ResearchConversation[];
  loading: boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

/** Earlier conversations with the Brain, newest first, on the library board. */
export default function RecentChats({ conversations, loading, onOpen, onDelete }: RecentChatsProps) {
  const [showAll, setShowAll] = useState(false);
  const [deleting, setDeleting] = useState<ResearchConversation | null>(null);
  const shown = showAll ? conversations : conversations.slice(0, LIMIT);

  return (
    <section className="mx-auto mt-10 max-w-4xl px-4 md:px-10">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[13px] font-semibold text-[#1C1B17]">Your chats</h3>
        {conversations.length > LIMIT && (
          <button onClick={() => setShowAll((v) => !v)} className="text-xs text-[#6F6A60] hover:text-[#1C1B17]">
            {showAll ? 'Show fewer' : `View all ${conversations.length}`}
          </button>
        )}
      </div>

      {loading && <p className="mt-3 text-sm text-[#6F6A60]">Loading conversations…</p>}
      {!loading && conversations.length === 0 && (
        <p className="mt-3 text-sm text-[#6F6A60]">No conversations yet. Ask the Brain a question below and it will be kept here, private to you.</p>
      )}

      <ul className="mt-3 grid gap-2 md:grid-cols-2">
        {shown.map((c) => (
          <li key={c.id} className="group relative">
            <button
              onClick={() => onOpen(c.id)}
              className="flex w-full items-start gap-3 rounded-lg border border-[#E4DDCC] bg-[#FBF7ED] px-3.5 py-3 pr-10 text-left transition-colors hover:border-[#1C1B17]/25"
            >
              <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-[#8B857A]" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-[#1C1B17]" title={c.title}>{shortChatTitle(c.title)}</span>
                <span className="mt-0.5 block text-xs text-[#6F6A60]">Last message {lastActive(c.updated_at).toLowerCase()}</span>
              </span>
            </button>
            <button
              onClick={() => setDeleting(c)}
              aria-label={`Delete ${c.title}`}
              className="absolute right-2 top-2.5 rounded-md p-1.5 text-[#8B857A] hover:bg-[#B23B2A]/10 hover:text-[#B23B2A] md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>

      <DeleteChatDialog conversation={deleting} onCancel={() => setDeleting(null)} onConfirm={onDelete} />
    </section>
  );
}
