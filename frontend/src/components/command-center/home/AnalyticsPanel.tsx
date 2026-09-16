import { useMemo } from 'react'
import { ResponsiveBar } from '@nivo/bar'
import TerminalPanel, { PanelEmpty } from './TerminalPanel'
import { KIND_LABELS } from '@/lib/commandCenter/constants'
import { formatDayShort } from '@/lib/commandCenter/format'
import { weeklyCounts, type AnalystLensRow } from '@/lib/commandCenter/home'
import type { ActivityFeedRow, EventKind, RosterMember, TeamOption } from '@/lib/commandCenter/types'

const KIND_COLORS: Record<EventKind, string> = {
  management_meeting: '#1C1B17',
  concall: '#2F8F5B',
  annual_report: '#8FC4A6',
  broker_report: '#D06030',
  agm: '#6F6A60',
  other: '#CFC8B8',
}
const KINDS = Object.keys(KIND_LABELS) as EventKind[]

interface Props {
  entries: ActivityFeedRow[]
  analysts: AnalystLensRow[]
  roster: RosterMember[] | null
  /** Shown as a per-team split when the admin is looking at all teams. */
  teams: TeamOption[] | null
  now: Date
  className?: string
}

function Bars({ rows }: { rows: Array<{ label: string; value: number; sub?: string }> }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="flex flex-col gap-1">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[7rem_minmax(0,1fr)_2rem] items-center gap-2 font-mono text-[11px]">
          <span className="truncate text-[#1C1B17]" title={r.label}>{r.label}</span>
          <span className="h-2.5 bg-[#E3DDCF]">
            <span className="block h-full bg-[#1C1B17]" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums text-[#1C1B17]">{r.value}</span>
        </li>
      ))}
    </ul>
  )
}

const label = 'mb-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[#6F6A60]'

/** Counts of what the desk logged and how it was reviewed. No projections, no scores. */
export default function AnalyticsPanel({ entries, analysts, roster, teams, now, className }: Props) {
  const weekly = useMemo(() => weeklyCounts(entries, now, 5), [entries, now])
  const kindsPresent = KINDS.filter((k) => weekly.some((w) => (w[k] ?? 0) > 0))
  const totalWeeks = weekly.reduce((n, w) => n + KINDS.reduce((m, k) => m + (w[k] ?? 0), 0), 0)

  const perTeam = useMemo(() => {
    if (!teams?.length || !roster) return []
    return teams.map((t) => ({
      label: t.name,
      value: analysts
        .filter((a) => roster.find((m) => m.user_id === a.userId)?.team_ids.includes(t.id))
        .reduce((n, a) => n + a.entries30d, 0),
    })).sort((a, b) => b.value - a.value)
  }, [teams, roster, analysts])

  const endorsed = analysts.reduce((n, a) => n + a.endorsed, 0)
  const rejected = analysts.reduce((n, a) => n + a.rejected, 0)
  const unreviewed = analysts.reduce((n, a) => n + a.unreviewed, 0)
  const reviewedPct = endorsed + rejected + unreviewed > 0
    ? Math.round(((endorsed + rejected) / (endorsed + rejected + unreviewed)) * 100) : null

  return (
    <TerminalPanel code="STAT" title="Desk analytics" className={className}>
      {totalWeeks === 0 && analysts.every((a) => a.entries30d === 0) ? (
        <PanelEmpty>No logged entries in the last five weeks to chart.</PanelEmpty>
      ) : (
        <div className="grid gap-4 p-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)_minmax(0,2fr)]">
          <div className="min-w-0">
            <p className={label}>Entries per week · by type</p>
            <div className="h-[180px]">
              <ResponsiveBar
                data={weekly.map((w) => ({ ...w, week: formatDayShort(w.week) }))}
                keys={kindsPresent}
                indexBy="week"
                margin={{ top: 4, right: 4, bottom: 22, left: 24 }}
                padding={0.35}
                colors={({ id }) => KIND_COLORS[id as EventKind]}
                enableLabel={false}
                axisLeft={{ tickSize: 0, tickPadding: 4, tickValues: 4 }}
                axisBottom={{ tickSize: 0, tickPadding: 6 }}
                gridYValues={4}
                tooltipLabel={(d) => `${KIND_LABELS[d.id as EventKind]} · ${d.indexValue}`}
                theme={{
                  text: { fontFamily: 'ui-monospace, monospace', fontSize: 10, fill: '#6F6A60' },
                  grid: { line: { stroke: '#E3DDCF' } },
                  tooltip: { container: { fontFamily: 'ui-monospace, monospace', fontSize: 11 } },
                }}
              />
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
              {kindsPresent.map((k) => (
                <span key={k} className="inline-flex items-center gap-1 font-mono text-[10px] text-[#6F6A60]">
                  <span className="h-2 w-2" style={{ backgroundColor: KIND_COLORS[k] }} />{KIND_LABELS[k]}
                </span>
              ))}
            </div>
          </div>

          <div className="min-w-0">
            <p className={label}>Entries · 30d · by {perTeam.length ? 'team' : 'analyst'}</p>
            <Bars
              rows={perTeam.length
                ? perTeam
                : analysts.slice(0, 10).map((a) => ({ label: a.name, value: a.entries30d }))}
            />
          </div>

          <div className="min-w-0">
            <p className={label}>Reviews · 30d</p>
            <div className="grid grid-cols-3 border border-[#D7D0C2]">
              {[
                { k: 'Endorsed', v: endorsed, c: '#2F8F5B' },
                { k: 'Rejected', v: rejected, c: '#B23B2A' },
                { k: 'Unreviewed', v: unreviewed, c: '#B04E22' },
              ].map((s, i) => (
                <div key={s.k} className={`px-2 py-1.5 ${i ? 'border-l border-[#D7D0C2]' : ''}`}>
                  <span className="block font-mono text-[9px] uppercase tracking-[0.1em] text-[#6F6A60]">{s.k}</span>
                  <span className="font-mono text-lg font-semibold tabular-nums" style={{ color: s.c }}>{s.v}</span>
                </div>
              ))}
            </div>
            {reviewedPct !== null && (
              <p className="mt-1.5 font-mono text-[10px] text-[#6F6A60]">
                {reviewedPct}% of entries from the last 30 days have a verdict.
              </p>
            )}
          </div>
        </div>
      )}
    </TerminalPanel>
  )
}
