import { useState } from 'react';
import { Loader2, SquarePen, Trash2 } from 'lucide-react';
import { groupConversations, lastActive } from '../../../lib/researchChat';
import DeleteChatDialog from './DeleteChatDialog';
import type { ResearchConversation } from '../../../types/researchChat';

interface ChatHistoryListProps {
  conversations: ResearchConversation[];
  loading: boolean;
  activeId: string | undefined;
  onOpen: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

/** The Brain conversations in the side panel, grouped by day as in Claude's sidebar. */
export default function ChatHistoryList({ conversations, loading, activeId, onOpen, onNew, onDelete }: ChatHistoryListProps) {
  const [deleting, setDeleting] = useState<ResearchConversation | null>(null);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 px-4 pb-1 pt-3">
        <h2 className="text-[13px] font-semibold text-[#1C1B17]">
          Chats <span className="font-normal tabular-nums text-[#8B857A]">{conversations.length || ''}</span>
        </h2>
        <button
          onClick={onNew}
          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-[#1C1B17] transition-colors hover:bg-[#1C1B17]/[0.05] active:scale-[0.97]"
        >
          <SquarePen className="h-3.5 w-3.5" /> New
        </button>
      </div>

      <nav aria-label="Chats" className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {loading && <p className="flex items-center gap-2 px-2 py-2 text-sm text-[#6F6A60]"><Loader2 className="h-4 w-4 animate-spin" />Loading chats…</p>}
        {!loading && conversations.length === 0 && (
          <p className="px-2 py-2 text-sm text-[#6F6A60]">Questions you ask the Brain are kept here, private to you.</p>
        )}
        {groupConversations(conversations).map((g) => (
          <div key={g.label} className="mt-2">
            <p className="px-2 pb-1 text-xs text-[#8B857A]">{g.label}</p>
            <ul>
              {g.items.map((c) => {
                const active = c.id === activeId;
                return (
                  <li key={c.id} className={`group flex items-center rounded-md ${active ? 'bg-[#1C1B17]/[0.07]' : 'hover:bg-[#1C1B17]/[0.04]'}`}>
                    <button
                      onClick={() => onOpen(c.id)}
                      title={`${c.title} · ${lastActive(c.updated_at)}`}
                      aria-current={active ? 'page' : undefined}
                      className="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-[13px] text-[#1C1B17]"
                    >
                      {c.title}
                    </button>
                    <button
                      onClick={() => setDeleting(c)}
                      aria-label={`Delete ${c.title}`}
                      className="mr-1 shrink-0 rounded p-1 text-[#8B857A] hover:bg-[#B23B2A]/10 hover:text-[#B23B2A] md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <DeleteChatDialog conversation={deleting} onCancel={() => setDeleting(null)} onConfirm={onDelete} />
    </div>
  );
}
