import { useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { groupConversations } from '../../../lib/researchChat';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Button } from '../../ui/button';
import type { ResearchConversation } from '../../../types/researchChat';

interface ConversationListProps {
  conversations: ResearchConversation[];
  activeId: string | undefined;
  loading: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

export default function ConversationList({
  conversations, activeId, loading, onSelect, onNew, onRename, onDelete,
}: ConversationListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [deleting, setDeleting] = useState<ResearchConversation | null>(null);

  const commitRename = () => {
    const title = draft.trim();
    if (editingId && title) onRename(editingId, title);
    setEditingId(null);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <button onClick={onNew} className="flex w-full items-center justify-center gap-2 rounded-md bg-[#1C1B17] px-3 py-2 text-sm font-medium text-[#FBF7ED] active:scale-[0.98]">
          <Plus className="w-4 h-4" /> New chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {loading && <p className="px-2 text-sm text-[#6F6A60]">Loading…</p>}
        {!loading && conversations.length === 0 && (
          <p className="px-2 text-sm text-[#6F6A60]">No conversations yet.</p>
        )}
        {groupConversations(conversations).map((group) => (
          <div key={group.label} className="mb-3">
            <div className="px-2 py-1 text-xs font-medium text-[#6F6A60]">{group.label}</div>
            {group.items.map((c) => (
              <div
                key={c.id}
                className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 ${c.id === activeId ? 'bg-[#1C1B17]/[0.07]' : 'hover:bg-[#1C1B17]/5'}`}
              >
                {editingId === c.id ? (
                  <>
                    <input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename();
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="min-w-0 flex-1 rounded border border-[#D7D0C2] bg-white px-1.5 py-0.5 text-sm"
                    />
                    <button onClick={commitRename} aria-label="Save name"><Check className="w-4 h-4 text-[#1D4ED8]" /></button>
                    <button onClick={() => setEditingId(null)} aria-label="Cancel"><X className="w-4 h-4 text-[#6F6A60]" /></button>
                  </>
                ) : (
                  <>
                    <button onClick={() => onSelect(c.id)} className="min-w-0 flex-1 truncate text-left text-sm text-[#1C1B17]" title={c.title}>
                      {c.title}
                    </button>
                    <button
                      onClick={() => { setEditingId(c.id); setDraft(c.title); }}
                      aria-label={`Rename ${c.title}`}
                      className="p-1 text-[#6F6A60] hover:text-[#1D4ED8] md:opacity-0 md:group-hover:opacity-100"
                    ><Pencil className="w-3.5 h-3.5" /></button>
                    <button
                      onClick={() => setDeleting(c)}
                      aria-label={`Delete ${c.title}`}
                      className="p-1 text-[#6F6A60] hover:text-[#B23B2A] md:opacity-0 md:group-hover:opacity-100"
                    ><Trash2 className="w-3.5 h-3.5" /></button>
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this conversation?</DialogTitle>
            <DialogDescription>“{deleting?.title}” and all its messages will be permanently deleted.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => { if (deleting) onDelete(deleting.id); setDeleting(null); }}
            >Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
