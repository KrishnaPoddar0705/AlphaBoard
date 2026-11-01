import type { FolderMode, LibraryReport } from '../types/researchLibrary';

export interface ReportFolder {
  key: string;
  label: string;
  reports: LibraryReport[];
}

const UNFILED = 'Unfiled';

/** "[Kotak] Consumer Durables…" → "Kotak". Broker notes carry the house in brackets. */
export function brokerOf(report: Pick<LibraryReport, 'title' | 'original_filename'>): string {
  const m = (report.title || report.original_filename || '').match(/^\s*\[([^\]]{1,40})\]/);
  return m ? m[1].trim() : UNFILED;
}

const monthLabel = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

function folderKey(report: LibraryReport, mode: FolderMode): string {
  if (mode === 'sector') return report.sector?.trim() || UNFILED;
  if (mode === 'broker') return brokerOf(report);
  return report.created_at.slice(0, 7); // YYYY-MM sorts by time
}

/**
 * File reports into folders. Sector and broker folders are alphabetical with Unfiled last;
 * month folders are newest first. Reports keep their incoming (newest-first) order.
 */
export function groupIntoFolders(reports: LibraryReport[], mode: FolderMode): ReportFolder[] {
  const map = new Map<string, LibraryReport[]>();
  for (const r of reports) {
    const key = folderKey(r, mode);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  const folders = [...map.entries()].map(([key, items]) => ({
    key,
    label: mode === 'month' ? monthLabel(items[0].created_at) : key,
    reports: items,
  }));
  if (mode === 'month') return folders.sort((a, b) => b.key.localeCompare(a.key));
  return folders.sort((a, b) =>
    a.key === UNFILED ? 1 : b.key === UNFILED ? -1 : a.label.localeCompare(b.label),
  );
}

/**
 * Typo-tolerant match of one query word against a haystack: a substring, or the word's
 * letters in order inside a single haystack word ("kotk" finds "kotak", "dur" finds "durables").
 */
function wordMatches(word: string, haystackWords: string[], haystack: string): boolean {
  if (haystack.includes(word)) return true;
  if (word.length < 3) return false;
  return haystackWords.some((hw) => {
    if (hw.length < word.length) return false;
    let i = 0;
    for (const ch of hw) if (ch === word[i]) i++;
    return i === word.length && hw[0] === word[0];
  });
}

/** Every word of the query appears (loosely) in the title, file name, sector or tickers. */
export function fuzzyMatchReport(report: LibraryReport, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = [report.title, report.original_filename, report.sector, ...(report.tickers ?? [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const haystackWords = haystack.split(/[^a-z0-9&]+/).filter(Boolean);
  return words.every((w) => wordMatches(w, haystackWords, haystack));
}

/**
 * Questions for the composer's ghost text, written from what is actually in the library:
 * the open report first, then the selected sources, then its sectors and tickers.
 */
export function suggestQuestions(
  reports: LibraryReport[],
  opts: { openTitle?: string; scopeCount: number },
): string[] {
  const out: string[] = [];
  if (opts.openTitle) {
    out.push(`What are the key risks in ${opts.openTitle}?`);
    out.push('Summarise the investment thesis in three bullets');
  }
  if (opts.scopeCount > 1) out.push(`Where do these ${opts.scopeCount} reports disagree?`);

  const sectors = [...new Set(reports.map((r) => r.sector).filter((s): s is string => !!s))];
  const tickers = [...new Set(reports.flatMap((r) => r.tickers ?? []))];
  if (sectors[0]) out.push(`What is the outlook for ${sectors[0]} across our reports?`);
  if (tickers[0]) out.push(`What have analysts said about ${tickers[0]}?`);
  if (tickers[1]) out.push(`Compare the views on ${tickers[0]} and ${tickers[1]}`);
  if (sectors[1]) out.push(`Which catalysts are mentioned for ${sectors[1]}?`);
  out.push('What changed in our research this month?');
  return out;
}

/** The title without its "[Broker]" prefix. */
export const bareTitle = (title: string) => title.replace(/^\s*\[[^\]]{1,40}\]\s*/, '');

/** Put a broker in front of a title the way broker notes are named: "[Kotak] Consumer Durables…". */
export function withBroker(title: string, broker: string): string {
  const bare = bareTitle(title).trim();
  const b = broker.replace(/[[\]]/g, '').trim();
  return b ? `[${b}] ${bare}` : bare;
}
