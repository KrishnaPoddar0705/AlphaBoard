import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { LibraryReport, ReportDetailData } from '../types/researchLibrary';

export const reportKeys = {
  all: ['researchReports'] as const,
  list: () => [...reportKeys.all, 'list'] as const,
  detail: (id: string) => [...reportKeys.all, 'detail', id] as const,
};

// Supabase returns a to-one join as an object or a one-element array depending on the FK.
const flattenAnalyst = <T extends { analyst?: unknown }>(row: T) => ({
  ...row,
  analyst: Array.isArray(row.analyst) ? row.analyst[0] : row.analyst,
});

async function fetchReports(): Promise<LibraryReport[]> {
  const { data, error } = await supabase
    .from('research_reports')
    .select('id, title, sector, tickers, created_at, original_filename, upload_status, analyst:analyst_id ( username )')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(flattenAnalyst) as LibraryReport[];
}

/** Every report the org can see, newest first. Reports still being indexed are polled. */
export function useResearchReports() {
  return useQuery({
    queryKey: reportKeys.list(),
    queryFn: fetchReports,
    refetchInterval: (q) =>
      q.state.data?.some((r) => !['parsed', 'failed'].includes(r.upload_status)) ? 15_000 : false,
  });
}

export function useInvalidateReports() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: reportKeys.all });
}

async function fetchReportDetail(id: string): Promise<ReportDetailData> {
  const { data, error } = await supabase
    .from('research_reports')
    .select('*, analyst:analyst_id ( username )')
    .eq('id', id)
    .single();
  if (error) throw error;

  let pdfUrl = '';
  if (data.storage_path) {
    const { data: signed, error: urlError } = await supabase.storage
      .from('research-reports')
      .createSignedUrl(data.storage_path, 3600);
    if (signed) pdfUrl = signed.signedUrl;
    else console.warn('[ResearchWorkspace] Could not create PDF link:', urlError?.message);
  }
  return { ...(flattenAnalyst(data) as ReportDetailData), pdfUrl };
}

/** One report with its parsed summary and a one-hour signed PDF link. */
export function useReportDetail(id: string | null) {
  return useQuery({
    queryKey: reportKeys.detail(id ?? 'none'),
    queryFn: () => fetchReportDetail(id!),
    enabled: !!id,
    // The signed URL lasts an hour; refresh well before it lapses.
    staleTime: 30 * 60_000,
  });
}
