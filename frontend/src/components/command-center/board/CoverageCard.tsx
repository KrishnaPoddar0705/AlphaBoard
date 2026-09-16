import { Link } from 'react-router-dom'
import { CalendarClock, FileBarChart, PhoneCall, BookOpen, Users } from 'lucide-react'
import HealthDot from '../shared/HealthDot'
import { formatDayShort, relativeDays } from '@/lib/commandCenter/format'
import type { StockTeam } from '@/lib/commandCenter/teams'
import type { CoverageBoardRow } from '@/lib/commandCenter/types'

const TICK: Record<string, string> = { yes: '#2F8F5B', no: '#B23B2A', na: '#8B857A' }

function Stat({ icon: Icon, label, tone }: {
  icon: typeof PhoneCall; label: string; tone?: string
}) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[11px]"
          style={{ color: tone ?? '#6F6A60' }}>
      <Icon className="h-3 w-3" />{label}
    </span>
  )
}

/**
 * One covered stock. Everything on this card answers "does this name need my attention
 * today" -- staleness, whether the last concall and annual report were covered, how much
 * sell-side we hold, and what is coming up.
 */
export default function CoverageCard({ row, teams = [] }: { row: CoverageBoardRow; teams?: StockTeam[] }) {
  const pms = [...new Set(teams.flatMap((t) => t.pms))]
  return (
    <Link
      to={`/command-center/stock/${encodeURIComponent(row.ticker)}`}
      className="group flex flex-col gap-2.5 rounded-xl border border-[#D7D0C2] bg-[#F7F2E6] p-3.5 transition-colors hover:border-[#8B857A] hover:bg-[#FBF7ED]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm font-semibold text-[#1C1B17]">
            {row.company_name || row.ticker}
          </p>
          <p className="truncate font-mono text-[11px] text-[#6F6A60]">
            {row.ticker}{row.sector ? ` · ${row.sector}` : ''}
          </p>
        </div>
        <HealthDot
          daysSince={row.days_since_interaction}
          lastInteractionOn={row.last_interaction_on}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Stat
          icon={PhoneCall}
          label={row.latest_concall_period ?? 'no concall'}
          tone={row.latest_concall_attendance ? TICK[row.latest_concall_attendance] : undefined}
        />
        <Stat
          icon={BookOpen}
          label={row.latest_annual_report_period ?? 'no AR'}
          tone={row.latest_annual_report_attendance
            ? TICK[row.latest_annual_report_attendance] : undefined}
        />
        <Stat icon={FileBarChart} label={`${row.broker_report_count} broker`} />
        {row.contact_count > 0 && <Stat icon={Users} label={`${row.contact_count}`} />}
      </div>

      {/* Team and PM come from the owner's team membership; "last" is whoever's work
          the most recent logged entry is. Both lines only render what is known. */}
      {(teams.length > 0 || row.last_entry_by_username) && (
        <div className="flex flex-col gap-0.5 font-mono text-[11px]">
          {teams.length > 0 && (
            <span className="truncate text-[#1C1B17]">
              {teams.map((t) => t.name).join(', ')}
              <span className="text-[#6F6A60]">
                {pms.length > 0 ? ` · PM ${pms.join(', ')}` : ' · no PM'}
              </span>
            </span>
          )}
          {row.last_entry_by_username && row.last_interaction_on && (
            <span className="truncate text-[#6F6A60]">
              Last entry by <span className="text-[#1C1B17]">{row.last_entry_by_username}</span>
              {' · '}{relativeDays(row.last_interaction_on)}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-[#E3DDCF] pt-2">
        <span className="truncate font-mono text-[11px] text-[#6F6A60]">
          {row.lead_analyst_username ? `Lead: ${row.lead_analyst_username}` : 'No lead analyst'}
        </span>
        {row.next_scheduled_on && (
          <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[11px] text-[#D06030]">
            <CalendarClock className="h-3 w-3" />
            {formatDayShort(row.next_scheduled_on)}
          </span>
        )}
      </div>
    </Link>
  )
}
