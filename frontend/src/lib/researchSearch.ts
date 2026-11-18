// Keyword search results from the search_report_chunks RPC. Hits are wrapped in STX/ETX
// control characters (not HTML) so a snippet can be rendered as text nodes.

const STX = '\u0002';
const ETX = '\u0003';

export interface SnippetPart {
  text: string;
  hit: boolean;
}

export interface KeywordHit {
  report_id: string;
  title: string;
  sector: string | null;
  tickers: string[] | null;
  page_number: number;
  snippet: string;
  rank: number;
  report_hits: number;
}

export interface KeywordReportGroup {
  report_id: string;
  title: string;
  sector: string | null;
  totalHits: number;
  hits: KeywordHit[];
}

/** Split a snippet into plain and highlighted parts. */
export function splitSnippet(snippet: string): SnippetPart[] {
  const parts: SnippetPart[] = [];
  let hit = false;
  for (const piece of snippet.split(/(\u0002|\u0003)/)) {
    if (piece === STX) hit = true;
    else if (piece === ETX) hit = false;
    else if (piece) parts.push({ text: piece, hit });
  }
  return parts;
}

/** Group page hits under their report, keeping the order reports first appear in (best rank first). */
export function groupByReport(hits: KeywordHit[]): KeywordReportGroup[] {
  const groups = new Map<string, KeywordReportGroup>();
  for (const h of hits) {
    let g = groups.get(h.report_id);
    if (!g) {
      g = { report_id: h.report_id, title: h.title, sector: h.sector, totalHits: Number(h.report_hits), hits: [] };
      groups.set(h.report_id, g);
    }
    g.hits.push(h);
  }
  return [...groups.values()];
}
