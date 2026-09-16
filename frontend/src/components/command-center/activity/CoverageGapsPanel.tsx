import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, BookOpen, CheckCircle2, PhoneOff, UserX } from 'lucide-react'
import { useCoverageBoard } from '@/hooks/commandCenter/useCoverage'
import { useActivityFeed, useDeskMembers } from '@/hooks/commandCenter/useActivityFeed'
import { HEALTH_BANDS } from '@/lib/commandCenter/constants'
import { recentQuarters, recentFiscalYears, formatQuarterLabel, formatFyLabel }
  from '@/lib/commandCenter/periods'
import { addDays, today, relativeDays } from '@/lib/commandCenter/format'
import type { CoverageBoardRow } from '@/lib/commandCenter/types'
import { Loading, RowsSkeleton, Bone } from '../shared/Skeleton'

interface Gap {
  key: string
  icon: typeof AlertTriangle
  title: string
  rows: Array<{ id: string; ticker: string; detail: string }>
}

function coverageLink(r: Pick<CoverageBoardRow, 'ticker'>) {
  return `/command-center/stock/${encodeURIComponent(r.ticker)}`
}

/**
 * What the desk has NOT done.
 *
 * The activity stream answers "what happened"; this answers the question an admin
 * actually has before an investment decision -- what is missing. Everything here is
 * derived from the coverage board, so it costs no extra query.
 */
export default function CoverageGapsPanel() {
  const { data: coverage = [], isPending: coveragePending } = useCoverageBoard()
  const { data: members = [], isPending: membersPending } = useDeskMembers()
  // A week of entries, purely to find who has logged nothing.
  const { data: recent, isPending: recentPending } =
    useActivityFeed({ from: addDays(today(), -7), to: today() })

  const gaps = useMemo<Gap[]>(() => {
    const lastQuarter = formatQuarterLabel(recentQuarters(1)[0])
    const lastFy = formatFyLabel(recentFiscalYears(1)[0])

    const cold = coverage
      .filter((c) => c.days_since_interaction !== null
        && c.days_since_interaction >= HEALTH_BANDS.stale)
      .sort((a, b) => (b.days_since_interaction ?? 0) - (a.days_since_interaction ?? 0))
      .map((c) => ({
        id: c.id, ticker: c.ticker,
        detail: `last touched ${relativeDays(c.last_interaction_on)}`,
      }))

    const untouched = coverage
      .filter((c) => c.days_since_interaction === null)
      .map((c) => ({ id: c.id, ticker: c.ticker, detail: 'nothing logged yet' }))

    const missedConcalls = coverage
      .filter((c) => c.latest_concall_period !== lastQuarter || c.latest_concall_attendance === 'no')
      .map((c) => ({
        id: c.id, ticker: c.ticker,
        detail: c.latest_concall_attendance === 'no' && c.latest_concall_period === lastQuarter
          ? `${lastQuarter} not attended`
          : `no ${lastQuarter} concall logged`,
      }))

    const missedReports = coverage
      .filter((c) => c.latest_annual_report_period !== lastFy)
      .map((c) => ({ id: c.id, ticker: c.ticker, detail: `${lastFy} not logged` }))

    const activeIds = new Set((recent?.rows ?? []).map((r) => r.analyst_id ?? r.created_by))
    const quiet = members
      .filter((m) => !activeIds.has(m.id))
      .map((m) => ({ id: m.id, ticker: m.username ?? m.id.slice(0, 8), detail: 'no entries this week' }))

    return [
      { key: 'cold', icon: AlertTriangle, title: 'Not touched in 90+ days', rows: cold },
      { key: 'untouched', icon: AlertTriangle, title: 'Never touched', rows: untouched },
      { key: 'concall', icon: PhoneOff, title: `Missing ${lastQuarter} concall`, rows: missedConcalls },
      { key: 'ar', icon: BookOpen, title: `Missing ${lastFy} annual report`, rows: missedReports },
      { key: 'quiet', icon: UserX, title: 'Quiet this week', rows: quiet },
    ].filter((g) => g.rows.length > 0)
  }, [coverage, members, recent])

  // "Quiet this week" and "no gaps" are claims about data; make neither before it loads.
  if (coveragePending || membersPending || recentPending) {
    return (
      <Loading label="Checking coverage gaps" className="grid gap-2.5 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <section key={i} className="rounded-xl border border-[#D7D0C2] bg-[#F7F2E6]">
            <header className="flex items-center gap-2 border-b border-[#E3DDCF] px-3 py-2">
              <Bone className="h-3 w-40" />
              <Bone className="ml-auto h-3 w-5" />
            </header>
            <div className="px-3"><RowsSkeleton rows={3} /></div>
          </section>
        ))}
      </Loading>
    )
  }

  if (coverage.length === 0) return null

  if (gaps.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-[#D7D0C2] bg-[#F7F2E6] px-4 py-3">
        <CheckCircle2 className="h-4 w-4 text-[#2F8F5B]" />
        <p className="font-mono text-xs text-[#1C1B17]">No gaps -- every name is current.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {gaps.map((gap) => {
        const Icon = gap.icon
        return (
          <section key={gap.key} className="rounded-xl border border-[#D7D0C2] bg-[#F7F2E6]">
            <header className="flex items-center gap-2 border-b border-[#E3DDCF] px-3 py-2">
              <Icon className="h-3.5 w-3.5 text-[#D06030]" />
              <h3 className="font-mono text-[11px] text-[#1C1B17]">{gap.title}</h3>
              <span className="ml-auto font-mono text-[11px] text-[#6F6A60]">{gap.rows.length}</span>
            </header>
            <ul className="max-h-44 divide-y divide-[#E3DDCF] overflow-y-auto">
              {gap.rows.slice(0, 12).map((r) => (
                <li key={r.id}>
                  {gap.key === 'quiet' ? (
                    <span className="flex items-center justify-between gap-2 px-3 py-1.5">
                      <span className="font-mono text-xs text-[#1C1B17]">{r.ticker}</span>
                      <span className="font-mono text-[10px] text-[#6F6A60]">{r.detail}</span>
                    </span>
                  ) : (
                    <Link
                      to={coverageLink(r)}
                      className="flex items-center justify-between gap-2 px-3 py-1.5 transition-colors hover:bg-[rgba(28,27,23,0.04)]"
                    >
                      <span className="font-mono text-xs text-[#1C1B17]">{r.ticker}</span>
                      <span className="font-mono text-[10px] text-[#6F6A60]">{r.detail}</span>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
