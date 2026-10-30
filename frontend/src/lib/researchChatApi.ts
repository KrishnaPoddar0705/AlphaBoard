import { supabase } from './supabase';
import type { ResearchConversation, ResearchMessage, SendMessageResult } from '../types/researchChat';

// Reads, renames and deletes go straight to Supabase: row-level security limits them to the
// signed-in user's own threads. Writing messages is the edge function's job.

export async function listConversations(): Promise<ResearchConversation[]> {
  const { data, error } = await supabase
    .from('research_conversations')
    .select('id, title, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function getMessages(conversationId: string): Promise<ResearchMessage[]> {
  const { data, error } = await supabase
    .from('research_messages')
    .select('id, conversation_id, role, content, response, scope_report_ids, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ResearchMessage[];
}

export async function renameConversation(id: string, title: string): Promise<void> {
  const { error } = await supabase.from('research_conversations').update({ title }).eq('id', id);
  if (error) throw error;
}

export async function deleteConversation(id: string): Promise<void> {
  const { error } = await supabase.from('research_conversations').delete().eq('id', id);
  if (error) throw error;
}

export async function sendMessage(params: {
  query: string;
  conversationId?: string | null;
  reportIds?: string[];
}): Promise<SendMessageResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const response = await fetch(`${supabaseUrl}/functions/v1/query-research-rag`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: params.query,
      filters: {},
      conversation_id: params.conversationId ?? undefined,
      report_ids: params.reportIds?.length ? params.reportIds : undefined,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Search failed');
  }
  const data: SendMessageResult = await response.json();
  // The function answers 200 with an apology when the pipeline fails; treat that as an error
  // so the thread shows a retry instead of an answer.
  if (data.pipeline_failed) throw new Error(data.error || 'The AI could not answer this one. Please try again.');
  return data;
}
