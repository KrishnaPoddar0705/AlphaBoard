import { useQuery } from '@tanstack/react-query';
import { searchReportText } from '../lib/reportSearchApi';
import { useDebounce } from './useDebounce';

const MIN_CHARS = 2;

/**
 * Keyword search over report text as you type: waits for a pause and does nothing for very
 * short input. `reportIds` limits the search to those reports (the library's live filters);
 * leave it undefined to search every report you can see. An empty list matches nothing.
 */
export function useReportSearch(rawQuery: string, reportIds?: string[]) {
  const query = useDebounce(rawQuery.trim(), 350);
  const enabled = query.length >= MIN_CHARS && (reportIds === undefined || reportIds.length > 0);
  const result = useQuery({
    queryKey: ['reportKeywordSearch', query, reportIds ? [...reportIds].sort() : null],
    queryFn: () => searchReportText(query, reportIds),
    enabled,
    staleTime: 60_000,
  });
  return { ...result, query, enabled, pending: rawQuery.trim() !== query };
}
