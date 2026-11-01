import { useState } from 'react';
import {
  useConversations, useMessages, useSendMessage, useRenameConversation, useDeleteConversation,
} from './useResearchChat';
import { getUserFriendlyError } from '../lib/errorSanitizer';
import type { ChatReport } from '../types/researchChat';

/**
 * The Brain's conversation state for the research workspace. The open conversation lives
 * in the URL (`?chat=<id>`), so `conversationId` and `setConversationId` come from the page.
 */
export function useBrainChat(conversationId: string | undefined, setConversationId: (id: string | undefined) => void) {
  const [pending, setPending] = useState<string | null>(null);
  const [pendingScope, setPendingScope] = useState<ChatReport[]>([]);
  const [error, setError] = useState<string | null>(null);

  const conversations = useConversations();
  const messages = useMessages(conversationId);
  const send = useSendMessage();
  const rename = useRenameConversation();
  const remove = useDeleteConversation();

  // Awaited rather than passed as mutate() callbacks: those are dropped if the component
  // re-subscribes while the request is in flight, which left the thread on "Drafting…".
  const ask = async (question: string, scope: ChatReport[]) => {
    setPending(question);
    setPendingScope(scope);
    setError(null);
    try {
      const result = await send.mutateAsync({ query: question, conversationId, reportIds: scope.map((r) => r.id) });
      setPending(null);
      if (result.conversation_id && result.conversation_id !== conversationId) setConversationId(result.conversation_id);
    } catch (err) {
      setError(getUserFriendlyError(err));
    }
  };

  const reset = () => { setPending(null); setError(null); };

  return {
    conversations,
    messages,
    pending,
    pendingScope,
    error,
    busy: pending !== null && error === null,
    title: conversations.data?.find((c) => c.id === conversationId)?.title ?? 'New conversation',
    ask,
    retry: () => pending && ask(pending, pendingScope),
    /** Forget an unsent or failed question without touching the URL. */
    reset,
    startNew: () => { reset(); setConversationId(undefined); },
    select: (id: string) => { reset(); setConversationId(id); },
    rename: (id: string, title: string) => rename.mutate({ id, title }),
    remove: (id: string) => {
      remove.mutate(id);
      if (id === conversationId) { reset(); setConversationId(undefined); }
    },
  };
}

export type BrainChat = ReturnType<typeof useBrainChat>;
