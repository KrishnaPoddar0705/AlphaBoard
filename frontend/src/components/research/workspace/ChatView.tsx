import { ArrowLeft, SquarePen } from 'lucide-react';
import ChatThread from '../chat/ChatThread';
import { shortChatTitle } from '../../../lib/researchChat';
import type { BrainChat } from '../../../hooks/useBrainChat';
import type { ChatReport } from '../../../types/researchChat';

interface ChatViewProps {
  orgName: string;
  chat: BrainChat;
  conversationId: string | undefined;
  totalReports: number;
  examples: string[];
  onAsk: (q: string) => void;
  onAskAboutReport: (r: ChatReport) => void;
  onOpenReport: (id: string, page?: number) => void;
  /** Back to the library board; "New chat" goes there too, as in Claude. */
  onHome: () => void;
}

/** The conversation, filling the main board. The page's floating composer sits over its foot. */
export default function ChatView({ orgName, chat, conversationId, totalReports, examples, onAsk, onAskAboutReport, onOpenReport, onHome }: ChatViewProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b border-[#E4DDCC] px-3 py-2 md:px-6">
        <button onClick={onHome} aria-label="Back to the library" title="Back to the library" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#6F6A60] hover:bg-[#1C1B17]/[0.05] hover:text-[#1C1B17]">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-[#1C1B17]">{chat.pending && !conversationId ? shortChatTitle(chat.pending) : chat.title}</h2>
          <p className="truncate text-xs text-[#6F6A60]">{orgName} Brain</p>
        </div>
        <button onClick={onHome} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-[#1C1B17] hover:bg-[#1C1B17]/[0.05] active:scale-[0.97]">
          <SquarePen className="h-3.5 w-3.5" /> New chat
        </button>
      </header>

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
    </div>
  );
}
