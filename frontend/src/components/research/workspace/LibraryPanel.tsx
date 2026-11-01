import { useMemo, useState } from 'react';
import { ChevronRight, FileText, Folder, FolderOpen, Loader2, Upload } from 'lucide-react';
import { groupIntoFolders } from '../../../lib/researchFolders';
import type { FolderMode, LibraryReport } from '../../../types/researchLibrary';

const MODES: Array<{ id: FolderMode; label: string }> = [
  { id: 'sector', label: 'Sector' },
  { id: 'broker', label: 'Broker' },
  { id: 'month', label: 'Month' },
];

interface LibraryPanelProps {
  orgName: string;
  reports: LibraryReport[];
  loading: boolean;
  folderMode: FolderMode;
  onFolderMode: (m: FolderMode) => void;
  activeId: string | null;
  onOpen: (id: string) => void;
  selected: Set<string>;
  onSelect: (ids: string[], on: boolean) => void;
  onUpload: () => void;
}

function Check({ state, onChange, label }: { state: 'on' | 'off' | 'some'; onChange: (on: boolean) => void; label: string }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={state === 'on'}
      ref={(el) => { if (el) el.indeterminate = state === 'some'; }}
      onChange={(e) => onChange(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
      className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-[#1D4ED8]"
    />
  );
}

const statusDot: Record<string, string> = { failed: 'bg-[#B23B2A]', parsed: '' };

export default function LibraryPanel(props: LibraryPanelProps) {
  const { reports, selected, activeId, folderMode } = props;
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const folders = useMemo(() => groupIntoFolders(reports, folderMode), [reports, folderMode]);

  const toggleFolder = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#FBF7ED]">
      <div className="px-4 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold leading-tight text-[#1C1B17]">Institutional Memory</h1>
            <p className="mt-0.5 truncate text-xs text-[#6F6A60]">
              {props.orgName} · {reports.length} report{reports.length === 1 ? '' : 's'}
            </p>
          </div>
          <button
            onClick={props.onUpload}
            aria-label="Upload a report"
            title="Upload a report"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#1C1B17] text-[#FBF7ED] transition-transform hover:bg-[#2c2a24] active:scale-[0.95]"
          >
            <Upload className="h-4 w-4" />
          </button>
        </div>

        <div role="tablist" aria-label="File reports by" className="mt-3 flex rounded-md bg-[#F1EEE0] p-0.5 text-xs">
          {MODES.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={folderMode === m.id}
              onClick={() => props.onFolderMode(m.id)}
              className={`flex-1 rounded px-2 py-1 transition-colors ${folderMode === m.id ? 'bg-[#FBF7ED] font-medium text-[#1C1B17]' : 'text-[#6F6A60] hover:text-[#1C1B17]'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <nav aria-label="Reports" className="mt-2 min-h-0 flex-1 overflow-y-auto px-2 pb-24">
        {props.loading && <p className="flex items-center gap-2 px-2 py-3 text-sm text-[#6F6A60]"><Loader2 className="h-4 w-4 animate-spin" />Loading reports…</p>}
        {!props.loading && reports.length === 0 && (
          <p className="px-2 py-3 text-sm text-[#6F6A60]">No reports yet. Upload a PDF to start the library.</p>
        )}

        {folders.map((f) => {
          const open = !collapsed.has(f.key);
          const ids = f.reports.map((r) => r.id);
          const nSel = ids.filter((id) => selected.has(id)).length;
          const FolderIcon = open ? FolderOpen : Folder;
          return (
            <div key={f.key} className="mt-1">
              <div className="group flex items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-[#1C1B17]/[0.04]">
                <button onClick={() => toggleFolder(f.key)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-[13px] text-[#1C1B17]">
                  <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-[#8B857A] transition-transform ${open ? 'rotate-90' : ''}`} />
                  <FolderIcon className="h-4 w-4 shrink-0 text-[#8B857A]" />
                  <span className="truncate font-medium">{f.label}</span>
                  <span className="ml-auto pl-1 text-xs tabular-nums text-[#8B857A]">{f.reports.length}</span>
                </button>
                <span className={nSel ? '' : 'md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100'}>
                  <Check
                    label={`Ask about every report in ${f.label}`}
                    state={nSel === 0 ? 'off' : nSel === ids.length ? 'on' : 'some'}
                    onChange={(on) => props.onSelect(ids, on)}
                  />
                </span>
              </div>

              {open && (
                <ul className="ml-[18px] border-l border-[#E4DDCC] pl-1.5">
                  {f.reports.map((r) => {
                    const active = r.id === activeId;
                    const isSel = selected.has(r.id);
                    return (
                      <li key={r.id} className={`group flex items-center gap-1.5 rounded-md px-1.5 py-1 ${active ? 'bg-[#1C1B17]/[0.07]' : 'hover:bg-[#1C1B17]/[0.04]'}`}>
                        <button onClick={() => props.onOpen(r.id)} title={r.title} aria-current={active ? 'page' : undefined} className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-[13px] text-[#1C1B17]">
                          <FileText className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-[#1D4ED8]' : 'text-[#8B857A]'}`} />
                          <span className="truncate">{r.title}</span>
                          {r.upload_status !== 'parsed' && (
                            <span
                              title={r.upload_status === 'failed' ? 'Processing failed' : `Still ${r.upload_status}`}
                              className={`ml-auto h-1.5 w-1.5 shrink-0 rounded-full ${statusDot[r.upload_status] ?? 'animate-pulse bg-[#B7791F]'}`}
                            />
                          )}
                        </button>
                        <span className={isSel ? '' : 'md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100'}>
                          <Check label={`Ask about ${r.title}`} state={isSel ? 'on' : 'off'} onChange={(on) => props.onSelect([r.id], on)} />
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
