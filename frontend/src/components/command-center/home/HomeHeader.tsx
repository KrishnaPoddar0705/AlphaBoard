import type { ReactNode } from 'react'
import { BellRing, Building2, FileText, TrendingUp, type LucideIcon } from 'lucide-react'
import { eventTypeOf } from '@/lib/commandCenter/constants'
import { ownerName, relativeTime, type HomeSummary } from '@/lib/commandCenter/home'

interface Props {
  now: Date
  name: string | null
  /** "Your team" / "The desk" / "You" / "Aditi" -- whoever the scope covers. */
  subject: string
  summary: HomeSummary
  needsYou: number
  updatedAt: number
  scopeControls: ReactNode
}

function greeting(now: Date): string {
  const h = now.getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

/**
 * The first three seconds: date, how much the desk logged since yesterday, and four
 * numbers. Every number is a count of entries people made; none is a score.
 */
export default function HomeHeader({ now, name, subject, summary, needsYou, updatedAt, scopeControls }: Props) {
  const { entries24h, companies24h, thesisChanges7d, lastEntry } = summary
  const verb = subject === 'You' ? 'have' : 'has'

  const headline = entries24h > 0
    ? `${subject} logged ${entries24h} ${entries24h === 1 ? 'entry' : 'entries'} across ${companies24h} ${companies24h === 1 ? 'company' : 'companies'} since yesterday.`
    : lastEntry
      ? `${subject} ${verb} logged nothing in the last 24 hours. Last entry: ${lastEntry.ticker} ${eventTypeOf(lastEntry.kind, lastEntry.subtype).label} by ${ownerName(lastEntry)}, ${relativeTime(lastEntry.created_at, now)}.`
      : `Nothing logged yet in this scope.`

  const kpis: Array<{ label: string; value: number; tone?: string; href?: string; icon: LucideIcon }> = [
    { label: 'Entries · 24h', value: entries24h, icon: FileText },
    { label: 'Companies · 24h', value: companies24h, icon: Building2 },
    { label: 'Thesis changes · 7d', value: thesisChanges7d, icon: TrendingUp },
    { label: 'Need you', value: needsYou, tone: needsYou > 0 ? 'var(--color-chart-orange)' : undefined, href: '#cc-needs', icon: BellRing },
  ]

  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink pb-2">
        <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink">
          <span className="font-semibold">Command Center</span>
          <span className="inline-flex items-center gap-1 text-positive">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-positive motion-reduce:animate-none" />
            Live
          </span>
          {updatedAt > 0 && (
            <span className="hidden text-ink-faint sm:inline">
              updated {new Date(updatedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink">
          {now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-mono text-xl font-semibold text-ink sm:text-2xl board:text-[28px] board:tracking-[-0.02em]">
            {greeting(now)}{name ? `, ${name}` : ''}.
          </h1>
          <p className="mt-1 max-w-2xl font-mono text-xs leading-relaxed text-[#3A3830] sm:text-sm board:text-ink-muted">{headline}</p>
        </div>
        <div className="shrink-0">{scopeControls}</div>
      </div>

      <div className="grid grid-cols-2 overflow-hidden rounded-md border border-ink sm:grid-cols-4 board:gap-3 board:overflow-visible board:rounded-none board:border-0">
        {kpis.map((k, i) => {
          const body = (
            <>
              {/* BoardUI stat card: white icon chip top-left. Board skin only. */}
              <span className="hidden w-fit rounded-md bg-paper-light p-1.5 shadow-card board:flex" aria-hidden="true">
                <k.icon className="h-4 w-4 text-ink-soft" />
              </span>
              <div>
              <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted board:text-sm board:font-medium">{k.label}</span>
              <span
                className="block font-mono text-2xl font-semibold tabular-nums sm:text-3xl board:text-[28px] board:font-medium board:tracking-[-0.01em]"
                style={{ color: k.tone ?? 'var(--color-ink)' }}
              >
                {k.value}
              </span>
              </div>
            </>
          )
          const cls = [
            'bg-paper-alt px-3 py-2 board:flex board:min-h-[112px] board:flex-col board:justify-between board:rounded-2xl board:border-0 board:p-4 board:transition-colors',
            i % 2 === 1 ? 'border-l border-border-editorial' : '',
            i >= 2 ? 'border-t border-border-editorial sm:border-t-0' : '',
            i === 2 ? 'sm:border-l' : '',
          ].join(' ')
          return k.href
            ? <a key={k.label} href={k.href} className={`${cls} hover:bg-paper board:hover:bg-paper-sunk`}>{body}</a>
            : <div key={k.label} className={cls}>{body}</div>
        })}
      </div>
    </header>
  )
}
