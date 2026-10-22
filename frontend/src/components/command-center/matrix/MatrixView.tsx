import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Table2 } from 'lucide-react'
import './matrix.css'
import MatrixToolbar from './MatrixToolbar'
import MatrixTabs, { type MatrixTab } from './MatrixTabs'
import MatrixGrid from './MatrixGrid'
import MatrixMobileList from './MatrixMobileList'
import MatrixSkeleton from './MatrixSkeleton'
import MatrixPopView, { type MatrixSelection } from './MatrixPopView'
import EntryDrawer from '../home/EntryDrawer'
import LogEventSheet from '../entry/LogEventSheet'
import { useCoverageBoard } from '@/hooks/commandCenter/useCoverage'
import { useMatrixWindow, useMyTeams, useRoster } from '@/hooks/commandCenter/useHome'
import {
  MATRIX_COLUMNS, analystSubjects, bucketEvents, documentEntries, groupBySector, groupByTeam,
  matchesSearch, ownerId, stockSubjects, type MatrixDensity, type MatrixGrouping, type MatrixTheme,
} from '@/lib/commandCenter/matrix'
import type { ActivityFeedRow } from '@/lib/commandCenter/types'
import { track } from '@/lib/analytics'

const HIDDEN_KEY = 'cc_matrix_hidden_columns'
const DENSITY_KEY = 'cc_matrix_density'
const THEME_KEY = 'cc_matrix_theme'

function readTheme(): MatrixTheme {
  try { return localStorage.getItem(THEME_KEY) === 'graphite' ? 'graphite' : 'warm' }
  catch { return 'warm' }
}

function readDensity(): MatrixDensity {
  try {
    const v = localStorage.getItem(DENSITY_KEY)
    return v === 'compact' || v === 'expanded' ? v : 'default'
  } catch { return 'default' }
}

function readHidden(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]') as string[]) }
  catch { return new Set() }
}

/**
 * The Matrix: every row of the desk against every kind of work it logs, each cell a
 * timeline. "My Company" rows are stocks, tabbed by sector; "By Analyst" rows are people,
 * tabbed by team, each cell their work of that kind across every company. What a viewer
 * sees is whatever RLS already lets them see on the other tabs.
 *
 * Grouping and the open tab live in the URL (?group=team&tab=<id>) so a PM can share
 * "my team's matrix".
 */
export default function MatrixView({ onAdd }: { onAdd: () => void }) {
  const [params, setParams] = useSearchParams()
  const grouping: MatrixGrouping = params.get('group') === 'team' ? 'team' : 'sector'
  const tab = params.get('tab') ?? 'all'
  const [query, setQuery] = useState('')
  const [hidden, setHidden] = useState<Set<string>>(readHidden)
  const [density, setDensityState] = useState<MatrixDensity>(readDensity)
  const [theme, setThemeState] = useState<MatrixTheme>(readTheme)
  const [selection, setSelection] = useState<MatrixSelection | null>(null)
  const [entry, setEntry] = useState<ActivityFeedRow | null>(null)
  const [log, setLog] = useState<{ session: number; coverageId?: string; typeId?: string; open: boolean }>(
    { session: 0, open: false },
  )

  const board = useCoverageBoard()
  const feed = useMatrixWindow()
  const { data: teams } = useMyTeams()
  const { data: roster } = useRoster(null)

  useEffect(() => { track('cc_matrix_viewed', { grouping }) }, [grouping])

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value); else next.delete(key)
    if (key === 'group') next.delete('tab')
    setParams(next, { replace: true })
  }

  // "My Company" rows are stocks, so entries bucket by stock; "By Analyst" rows are
  // people, so the same entries bucket by whose work they are, across every company.
  const cells = useMemo(
    () => bucketEvents(feed.data ?? [], grouping === 'team' ? ownerId : (r) => r.coverage_id),
    [feed.data, grouping],
  )
  const columns = useMemo(() => MATRIX_COLUMNS.filter((c) => !hidden.has(c.id)), [hidden])

  const allGroups = useMemo(() => {
    const subjects = grouping === 'team'
      ? analystSubjects(roster, feed.data ?? [])
      : stockSubjects(board.data ?? [])
    const rows = subjects.filter((r) => matchesSearch(r, query))
    return grouping === 'team' ? groupByTeam(rows, teams) : groupBySector(rows)
  }, [board.data, feed.data, query, grouping, roster, teams])

  const tabs: MatrixTab[] = useMemo(() => {
    const unique = new Set(allGroups.flatMap((g) => g.rows.map((r) => r.id)))
    return [
      { key: 'all', label: 'All', count: unique.size },
      ...allGroups.map((g) => ({ key: g.key, label: g.label, count: g.rows.length })),
    ]
  }, [allGroups])

  const activeTab = tabs.some((t) => t.key === tab) ? tab : 'all'
  const groups = activeTab === 'all' ? allGroups : allGroups.filter((g) => g.key === activeTab)
  const showGroupHeaders = activeTab === 'all' && allGroups.length > 1

  const toggleColumn = (id: string) => setHidden((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    try { localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next])) } catch { /* private mode */ }
    return next
  })

  const setDensity = (d: MatrixDensity) => {
    setDensityState(d)
    try { localStorage.setItem(DENSITY_KEY, d) } catch { /* private mode */ }
  }

  const setTheme = (t: MatrixTheme) => {
    setThemeState(t)
    try { localStorage.setItem(THEME_KEY, t) } catch { /* private mode */ }
  }

  const open = useCallback((sel: MatrixSelection) => {
    setSelection(sel)
    track('cc_matrix_cell_opened', { column: sel.column })
  }, [])

  const openLog = useCallback((coverageId: string | undefined, typeId: string) => {
    setLog((l) => ({ session: l.session + 1, coverageId, typeId, open: true }))
  }, [])

  const panelEntries = useMemo(() => {
    if (!selection) return []
    const byType = cells.get(selection.subject.id)
    return selection.column === 'docs' ? documentEntries(byType) : byType?.get(selection.column) ?? []
  }, [selection, cells])

  const visible = new Set(groups.flatMap((g) => g.rows.map((r) => r.id)))
  const entryCount = [...visible].reduce((n, id) => {
    const byType = cells.get(id)
    return n + (byType ? [...byType.values()].reduce((m, l) => m + l.length, 0) : 0)
  }, 0)
  const one = visible.size === 1
  const noun = grouping === 'team' ? (one ? 'analyst' : 'analysts') : (one ? 'company' : 'companies')
  const summary = `${visible.size} ${noun} · ${entryCount} entries · last 12 months`

  const loading = board.isPending || feed.isPending
  const failed = board.error ?? feed.error

  return (
    <section className="mx space-y-3" data-theme={theme}>
      <MatrixTabs
        grouping={grouping}
        onGrouping={(g) => setParam('group', g === 'sector' ? null : g)}
        tabs={tabs}
        active={activeTab}
        onChange={(k) => setParam('tab', k === 'all' ? null : k)}
      />

      <div className="overflow-hidden rounded-(--mx-radius-lg) border border-(--mx-line) bg-(--mx-surface) shadow-(--mx-shadow)">
        <MatrixToolbar
          summary={summary}
          query={query}
          onQuery={setQuery}
          density={density}
          onDensity={setDensity}
          theme={theme}
          onTheme={setTheme}
          hidden={hidden}
          onToggleColumn={toggleColumn}
          onAdd={onAdd}
          onEnrich={() => track('cc_matrix_enrich_clicked', {})}
        />

        {failed ? (
          <p className="px-4 py-6 text-[12.5px] text-[#B23B2A]">{failed.message}</p>
        ) : loading ? (
          <MatrixSkeleton />
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-4 py-16 text-center">
            <Table2 className="size-5 text-(--mx-text-3)" />
            <p className="text-[13px] font-medium text-(--mx-text)">
              {query ? 'Nothing matches that search' : grouping === 'team' ? 'No analysts to show' : 'Nothing in coverage yet'}
            </p>
            {!query && grouping !== 'team' && (
              <p className="max-w-sm text-[12px] text-(--mx-text-2)">
                Add a stock to start a row. Every concall, meeting and report you log fills in its cells.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <MatrixGrid grouping={grouping} groups={groups} showGroupHeaders={showGroupHeaders}
                columns={columns} cells={cells} density={density} selectedId={selection?.subject.id ?? null}
                onOpen={open} onLog={openLog} />
            </div>
            <div className="md:hidden">
              <MatrixMobileList groups={groups} showGroupHeaders={showGroupHeaders} columns={columns}
                cells={cells} onOpen={open} />
            </div>
          </>
        )}
      </div>

      <MatrixPopView
        key={selection ? `${selection.subject.id}:${selection.column}` : 'closed'}
        selection={selection}
        entries={panelEntries}
        onClose={() => setSelection(null)}
        onOpenEntry={setEntry}
        onLog={openLog}
        theme={theme}
      />
      <EntryDrawer entry={entry} onClose={() => setEntry(null)} />
      <LogEventSheet
        key={log.session}
        open={log.open}
        onClose={() => setLog((l) => ({ ...l, open: false }))}
        coverageId={log.coverageId}
        initialTypeId={log.typeId}
      />
    </section>
  )
}
