-- Conversational RAG: private, saved conversations over research reports.
-- Writes to both tables come from the query-research-rag edge function (service role);
-- clients can read, rename and delete their own threads but cannot insert or forge messages.

CREATE TABLE IF NOT EXISTS public.research_conversations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  filters JSONB,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_research_conversations_user_updated
  ON public.research_conversations(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.research_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id UUID REFERENCES public.research_conversations(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  response JSONB,
  standalone_question TEXT,
  report_ids_used UUID[],
  scope_report_ids UUID[],
  execution_time_ms INT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_research_messages_conversation_created
  ON public.research_messages(conversation_id, created_at);

ALTER TABLE public.report_queries
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.research_conversations(id) ON DELETE SET NULL;

ALTER TABLE public.research_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "research_conversations_select_own" ON public.research_conversations
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "research_conversations_update_own" ON public.research_conversations
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "research_conversations_delete_own" ON public.research_conversations
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "research_messages_select_own" ON public.research_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.research_conversations c
      WHERE c.id = research_messages.conversation_id AND c.user_id = auth.uid()
    )
  );
