import { supabase } from './supabase';
import type { KeywordHit } from './researchSearch';

// Row-level security limits the RPC to the caller's own organization; no Gemini is involved.
export async function searchReportText(query: string, reportIds?: string[]): Promise<KeywordHit[]> {
  const { data, error } = await supabase.rpc('search_report_chunks', {
    p_query: query,
    p_report_ids: reportIds?.length ? reportIds : null,
    p_limit: 40,
  });
  if (error) throw error;
  return (data ?? []) as KeywordHit[];
}
