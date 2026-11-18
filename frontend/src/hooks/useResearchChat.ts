import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listConversations, getMessages, renameConversation, deleteConversation, sendMessage,
} from '../lib/researchChatApi';
import type { ResearchConversation, ResearchMessage } from '../types/researchChat';

export const chatKeys = {
  all: ['researchChat'] as const,
  list: () => [...chatKeys.all, 'list'] as const,
  messages: (id: string) => [...chatKeys.all, 'messages', id] as const,
};

export function useConversations() {
  return useQuery<ResearchConversation[]>({ queryKey: chatKeys.list(), queryFn: listConversations });
}

export function useMessages(conversationId: string | undefined) {
  return useQuery<ResearchMessage[]>({
    queryKey: chatKeys.messages(conversationId ?? 'none'),
    queryFn: () => getMessages(conversationId!),
    enabled: !!conversationId,
  });
}

/** Sends a question; on success the saved thread and the sidebar list are refetched. */
export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: sendMessage,
    // Returning the promise keeps the mutation pending until the thread is loaded, so the
    // page never flashes between "waiting" and the saved answer.
    onSuccess: async (result) => {
      if (result.conversation_id) {
        const id = result.conversation_id;
        await qc.fetchQuery({ queryKey: chatKeys.messages(id), queryFn: () => getMessages(id), staleTime: 0 });
      }
      await qc.invalidateQueries({ queryKey: chatKeys.list() });
    },
  });
}

export function useRenameConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => renameConversation(id, title),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatKeys.list() }),
  });
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteConversation,
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: chatKeys.messages(id) });
      qc.invalidateQueries({ queryKey: chatKeys.list() });
    },
  });
}
