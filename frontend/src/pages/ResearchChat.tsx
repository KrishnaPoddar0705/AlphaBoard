import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Menu, Plus } from 'lucide-react';
import ConversationList from '../components/research/chat/ConversationList';
import ChatThread from '../components/research/chat/ChatThread';
import ChatComposer from '../components/research/chat/ChatComposer';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import {
  useConversations, useMessages, useSendMessage, useRenameConversation, useDeleteConversation,
} from '../hooks/useResearchChat';
import { getUserFriendlyError } from '../lib/errorSanitizer';
import type { ChatLocationState, ChatReport } from '../types/researchChat';

export default function ResearchChat() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [scope, setScope] = useState<ChatReport[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const conversations = useConversations();
  const messages = useMessages(conversationId);
  const send = useSendMessage();
  const rename = useRenameConversation();
  const remove = useDeleteConversation();

  const title = conversations.data?.find((c) => c.id === conversationId)?.title ?? 'New chat';

  // Awaited rather than passed as mutate() callbacks: those are dropped if the component
  // re-subscribes while the request is in flight (React StrictMode does that to the effect
  // below), which left the page on "Drafting the answer…" after the answer was saved.
  const ask = async (question: string, reportIds: string[] = scope.map((r) => r.id)) => {
    setPending(question);
    setError(null);
    try {
      const result = await send.mutateAsync({ query: question, conversationId, reportIds });
      setPending(null);
      if (result.conversation_id && result.conversation_id !== conversationId) {
        navigate(`/research/chat/${result.conversation_id}`, { replace: true });
      }
    } catch (err) {
      setError(getUserFriendlyError(err));
    }
  };

  // A question asked from the AI search bar on /research arrives as router state: send it
  // once, then clear the state so a refresh or Back doesn't ask it again.
  const handedOver = useRef(false);
  useEffect(() => {
    const handover = location.state as ChatLocationState | null;
    if (!handover?.question || handedOver.current) return;
    handedOver.current = true;
    navigate(location.pathname, { replace: true, state: null });
    const reports = (handover.reports ?? []) as ChatReport[];
    setScope(reports);
    ask(handover.question, reports.map((r) => r.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const startNew = () => {
    setPending(null);
    setError(null);
    setScope([]);
    setHistoryOpen(false);
    navigate('/research/chat');
  };

  const select = (id: string) => {
    setPending(null);
    setError(null);
    setHistoryOpen(false);
    navigate(`/research/chat/${id}`);
  };

  const list = (
    <ConversationList
      conversations={conversations.data ?? []}
      activeId={conversationId}
      loading={conversations.isLoading}
      onSelect={select}
      onNew={startNew}
      onRename={(id, t) => rename.mutate({ id, title: t })}
      onDelete={(id) => {
        remove.mutate(id);
        if (id === conversationId) startNew();
      }}
    />
  );

  return (
    <div className="flex h-[calc(100dvh-6rem)] min-h-[420px] overflow-hidden rounded-xl border border-[#D7D0C2] bg-[#F1EEE0]">
      <aside className="hidden md:block w-72 shrink-0 border-r border-[#D7D0C2] bg-[#FBF7ED]">{list}</aside>

      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="left" className="p-0">
          <SheetHeader className="px-4 pt-4"><SheetTitle>History</SheetTitle></SheetHeader>
          {list}
        </SheetContent>
      </Sheet>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-[#D7D0C2] px-3 py-2.5">
          <button className="md:hidden p-1.5" onClick={() => setHistoryOpen(true)} aria-label="Open history"><Menu className="w-5 h-5" /></button>
          <Link to="/research" className="hidden md:inline-flex items-center gap-1 text-xs text-[#6F6A60] hover:text-[#1C1B17]">
            <ArrowLeft className="w-3.5 h-3.5" /> Reports
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-sm font-semibold text-[#1C1B17]">{title}</h1>
          <button className="md:hidden p-1.5" onClick={startNew} aria-label="New chat"><Plus className="w-5 h-5" /></button>
        </header>

        <ChatThread
          messages={messages.data ?? []}
          loading={!!conversationId && messages.isLoading}
          pendingQuestion={pending}
          error={error}
          onRetry={() => pending && ask(pending)}
          onExample={ask}
          onAskAboutReport={(r) => setScope((prev) => (prev.some((p) => p.id === r.id) ? prev : [...prev, r]))}
        />

        <ChatComposer
          disabled={pending !== null && error === null}
          scope={scope}
          onRemoveScope={(id) => setScope((prev) => prev.filter((r) => r.id !== id))}
          onClearScope={() => setScope([])}
          onSend={ask}
        />
      </section>
    </div>
  );
}
