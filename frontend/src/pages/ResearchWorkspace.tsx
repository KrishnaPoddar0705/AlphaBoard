import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { FolderTree } from 'lucide-react';
import LibraryPanel from '../components/research/workspace/LibraryPanel';
import DocumentView from '../components/research/workspace/DocumentView';
import SearchResults from '../components/research/workspace/SearchResults';
import LibraryOverview from '../components/research/workspace/LibraryOverview';
import BrainComposer, { type ComposerMode } from '../components/research/workspace/BrainComposer';
import BrainPanel from '../components/research/workspace/BrainPanel';
import UploadReportModal from '../components/research/UploadReportModal';
import { Sheet, SheetContent, SheetTitle } from '../components/ui/sheet';
import { useResearchReports, useInvalidateReports } from '../hooks/useResearchReports';
import { useReportSearch } from '../hooks/useReportSearch';
import { useBrainChat } from '../hooks/useBrainChat';
import { useOrganization } from '../hooks/useOrganization';
import { fuzzyMatchReport, suggestQuestions } from '../lib/researchFolders';
import type { FolderMode } from '../types/researchLibrary';
import type { ChatReport } from '../types/researchChat';

const FOLDER_MODE_KEY = 'research.folderMode';
const readFolderMode = (): FolderMode => {
  try {
    const v = localStorage.getItem(FOLDER_MODE_KEY);
    return v === 'broker' || v === 'month' ? v : 'sector';
  } catch { return 'sector'; }
};

/**
 * Institutional Memory: the library, keyword search and the Brain (RAG chat) on one screen.
 * What is open lives in the URL — `?doc=<id>&page=<n>&find=<words>` for the report and
 * `?chat=<id>` for the conversation — so links, Back and refresh all land in the same place.
 */
export default function ResearchWorkspace() {
  const [params, setParams] = useSearchParams();
  const docId = params.get('doc');
  const page = Number(params.get('page')) || null;
  const findText = params.get('find') ?? '';
  const chatId = params.get('chat') ?? undefined;

  const patch = (next: Record<string, string | null>) =>
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(next)) if (v === null) p.delete(k); else p.set(k, v);
      return p;
    }, { replace: true });

  const { organization } = useOrganization();
  const orgName = organization?.name ?? 'Team';
  const reportsQuery = useResearchReports();
  const reports = useMemo(() => reportsQuery.data ?? [], [reportsQuery.data]);
  const invalidateReports = useInvalidateReports();

  const [query, setQuery] = useState('');
  const [folderMode, setFolderMode] = useState<FolderMode>(readFolderMode);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploadOpen, setUploadOpen] = useState(false);
  const [treeOpen, setTreeOpen] = useState(false); // the phone's folder sheet
  const [brainOpen, setBrainOpen] = useState(!!chatId);
  const [showResults, setShowResults] = useState(false);
  const [mode, setMode] = useState<ComposerMode>('ask');
  const [focusSignal, setFocusSignal] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => { try { localStorage.setItem(FOLDER_MODE_KEY, folderMode); } catch { /* private mode */ } }, [folderMode]);

  // "/" jumps to search from anywhere on the screen, as in most document tools.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== '/' || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable) return;
      e.preventDefault();
      setMode('search');
      setFocusSignal((n) => n + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const textSearch = useReportSearch(query);
  const trimmed = query.trim();
  const titleMatches = useMemo(() => (trimmed ? reports.filter((r) => fuzzyMatchReport(r, trimmed)) : reports), [reports, trimmed]);

  const scope: ChatReport[] = useMemo(
    () => reports.filter((r) => selected.has(r.id)).map((r) => ({ id: r.id, title: r.title, sector: r.sector ?? undefined })),
    [reports, selected],
  );
  const openTitle = reports.find((r) => r.id === docId)?.title;
  const suggestions = useMemo(
    () => suggestQuestions(reports, { openTitle: scope.length === 0 ? openTitle : undefined, scopeCount: scope.length }),
    [reports, openTitle, scope.length],
  );

  const chat = useBrainChat(chatId, (id) => patch({ chat: id ?? null }));

  const onQuery = (q: string) => { setQuery(q); setShowResults(q.trim().length > 0); };
  const select = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  const openReport = (id: string, p?: number) => {
    // Opening from a search hit carries the words, so a PDF viewer that can find text highlights them.
    patch({ doc: id, page: p ? String(p) : null, find: p && trimmed ? trimmed : null });
    setShowResults(false);
    setTreeOpen(false);
  };
  const ask = (q: string) => {
    if (mode === 'search') { setMode('ask'); setQuery(''); setShowResults(false); }
    setBrainOpen(true);
    chat.ask(q, scope);
  };
  const askAbout = (r: ChatReport) => { select([r.id], true); setBrainOpen(true); };

  const composer = (docked: boolean) => (
    <BrainComposer
      orgName={orgName}
      totalReports={reports.length}
      scope={scope}
      onRemoveScope={(id) => select([id], false)}
      onClearScope={() => setSelected(new Set())}
      onSend={ask}
      busy={chat.busy}
      suggestions={suggestions}
      mode={mode}
      onMode={(m) => {
        setMode(m);
        setShowResults(m === 'search' && trimmed.length > 0);
        // On a phone the Brain covers the screen, so step out of it to see search results.
        if (m === 'search' && window.innerWidth < 768) setBrainOpen(false);
      }}
      query={query}
      onQuery={onQuery}
      searching={textSearch.pending || textSearch.isFetching}
      focusSignal={focusSignal}
      autoFocus={docked}
    />
  );

  const library = (
    <LibraryPanel
      orgName={orgName}
      reports={reports}
      loading={reportsQuery.isLoading}
      folderMode={folderMode}
      onFolderMode={setFolderMode}
      activeId={docId}
      onOpen={(id) => openReport(id)}
      selected={selected}
      onSelect={select}
      onUpload={() => setUploadOpen(true)}
    />
  );

  let center: React.ReactNode;
  if (mode === 'search' && showResults && trimmed) {
    center = (
      <SearchResults
        query={trimmed}
        titleMatches={titleMatches}
        hits={textSearch.enabled ? textSearch.data : undefined}
        loading={textSearch.pending || textSearch.isFetching}
        error={textSearch.error}
        onOpen={openReport}
        onAsk={ask}
      />
    );
  } else if (docId) {
    center = (
      <DocumentView
        reportId={docId}
        page={page}
        findText={findText}
        onPage={(p) => patch({ page: String(p) })}
        onClose={() => patch({ doc: null, page: null, find: null })}
        inScope={selected.has(docId)}
        onToggleScope={() => select([docId], !selected.has(docId))}
      />
    );
  } else {
    center = (
      <LibraryOverview orgName={orgName} reports={reports} loading={reportsQuery.isLoading} onOpen={openReport} onUpload={() => setUploadOpen(true)} onAsk={ask} suggestions={suggestions} />
    );
  }

  return (
    <div className="flex h-[calc(100dvh-4rem)] min-h-[480px] overflow-hidden bg-[#F1EEE0] md:h-[calc(100dvh-5rem)]">
      <aside className="hidden w-[280px] shrink-0 border-r border-[#E4DDCC] md:block">{library}</aside>

      <Sheet open={treeOpen} onOpenChange={setTreeOpen}>
        <SheetContent side="left" className="w-[88vw] max-w-[340px] p-0">
          <SheetTitle className="sr-only">Reports</SheetTitle>
          {library}
        </SheetContent>
      </Sheet>

      <main className="relative flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-[#E4DDCC] px-3 py-2 md:hidden">
          <button onClick={() => setTreeOpen(true)} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-sm text-[#1C1B17] hover:bg-[#1C1B17]/[0.05]">
            <FolderTree className="h-4 w-4" /> Reports
            <span className="text-xs text-[#6F6A60]">{reports.length}</span>
          </button>
        </div>

        <div className="min-h-0 flex-1">{center}</div>

        <AnimatePresence>
          {!brainOpen && (
            <motion.div
              key="floating-composer"
              initial={reduce ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-6"
            >
              <div className="pointer-events-auto w-full max-w-3xl">
                {chatId && (
                  <button onClick={() => setBrainOpen(true)} className="mb-2 ml-3 text-xs text-[#6F6A60] underline-offset-2 hover:text-[#1C1B17] hover:underline">
                    Back to “{chat.title}”
                  </button>
                )}
                {composer(false)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {brainOpen && (
          <motion.aside
            key="brain"
            aria-label={`${orgName} Brain`}
            initial={reduce ? false : { x: 48, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { x: 48, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 34 }}
            className="fixed inset-0 z-50 md:static md:z-auto md:w-[440px] md:shrink-0 md:border-l md:border-[#E4DDCC] xl:w-[520px]"
          >
            <BrainPanel
              orgName={orgName}
              chat={chat}
              conversationId={chatId}
              totalReports={reports.length}
              examples={suggestions}
              onAsk={ask}
              onAskAboutReport={askAbout}
              onOpenReport={(id, p) => { openReport(id, p); if (window.innerWidth < 768) setBrainOpen(false); }}
              onCollapse={() => setBrainOpen(false)}
              composer={composer(true)}
            />
          </motion.aside>
        )}
      </AnimatePresence>

      <UploadReportModal isOpen={uploadOpen} onClose={() => setUploadOpen(false)} onSuccess={invalidateReports} />
    </div>
  );
}
