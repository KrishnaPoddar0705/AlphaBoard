import { useState } from 'react';
import { History, Minimize2, SquarePen, Sparkles } from 'lucide-react';
import ChatThread from '../chat/ChatThread';
import ConversationList from '../chat/ConversationList';
import type { BrainChat } from '../../../hooks/useBrainChat';
import type { ChatReport } from '../../../types/researchChat';

interface BrainPanelProps {
  orgName: string;
  chat: BrainChat;
  conversationId: string | undefined;
  totalReports: number;
  examples: string[];
  onAsk: (q: string) => void;
  onAskAboutReport: (r: ChatReport) => void;
  onOpenReport: (id: string, page?: number) => void;
  onCollapse: () => void;
  /** The docked composer, rendered by the page so it keeps one instance and its draft. */
  composer: React.ReactNode;
}

const iconBtn = 'inline-flex h-8 w-8 items-center justify-center rounded-md text-[#6F6A60] transition-colors hover:bg-[#1C1B17]/[0.06] hover:text-[#1C1B17]';

export default function BrainPanel({ orgName, chat, conversationId, totalReports, examples, onAsk, onAskAboutReport, onOpenReport, onCollapse, composer }: BrainPanelProps) {
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#F6F3E8]">
      <header className="flex items-center gap-2 border-b border-[#E4DDCC] px-3 py-2">
        <Sparkles className="h-4 w-4 shrink-0 text-[#1D4ED8]" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-[#1C1B17]">{orgName} Brain</h2>
          <p className="truncate text-xs text-[#6F6A60]">{showHistory ? 'Your conversations' : chat.title}</p>
        </div>
        <button onClick={() => setShowHistory((v) => !v)} aria-pressed={showHistory} aria-label="Conversation history" title="History" className={`${iconBtn} ${showHistory ? 'bg-[#1C1B17]/[0.07] text-[#1C1B17]' : ''}`}>
          <History className="h-4 w-4" />
        </button>
        <button onClick={() => { chat.startNew(); setShowHistory(false); }} aria-label="New conversation" title="New conversation" className={iconBtn}>
          <SquarePen className="h-4 w-4" />
        </button>
        <button onClick={onCollapse} aria-label="Minimise the Brain" title="Minimise" className={iconBtn}>
          <Minimize2 className="h-4 w-4" />
        </button>
      </header>

      {showHistory ? (
        <div className="min-h-0 flex-1">
          <ConversationList
            conversations={chat.conversations.data ?? []}
            activeId={conversationId}
            loading={chat.conversations.isLoading}
            onSelect={(id) => { chat.select(id); setShowHistory(false); }}
            onNew={() => { chat.startNew(); setShowHistory(false); }}
            onRename={chat.rename}
            onDelete={chat.remove}
          />
        </div>
      ) : (
        <ChatThread
          messages={chat.messages.data ?? []}
          loading={!!conversationId && chat.messages.isLoading}
          pendingQuestion={chat.pending}
          pendingScope={chat.pendingScope}
          totalReports={totalReports}
          error={chat.error}
          onRetry={chat.retry}
          examples={examples}
          onExample={onAsk}
          onAskAboutReport={onAskAboutReport}
          onOpenReport={onOpenReport}
        />
      )}

      <div className="px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1">{composer}</div>
    </div>
  );
}
