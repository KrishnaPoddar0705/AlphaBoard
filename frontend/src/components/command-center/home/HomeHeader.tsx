import type { ReactNode } from 'react'
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

  const kpis: Array<{ label: string; value: number; tone?: string; href?: string }> = [
    { label: 'Entries · 24h', value: entries24h },
    { label: 'Companies · 24h', value: companies24h },
    { label: 'Thesis changes · 7d', value: thesisChanges7d },
    { label: 'Need you', value: needsYou, tone: needsYou > 0 ? '#D06030' : undefined, href: '#cc-needs' },
  ]

  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1C1B17] pb-2">
        <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.14em] text-[#1C1B17]">
          <span className="font-semibold">Command Center</span>
          <span className="inline-flex items-center gap-1 text-[#2F8F5B]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#2F8F5B] motion-reduce:animate-none" />
            Live
          </span>
          {updatedAt > 0 && (
            <span className="hidden text-[#8B857A] sm:inline">
              updated {new Date(updatedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#1C1B17]">
          {now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-mono text-xl font-semibold text-[#1C1B17] sm:text-2xl">
            {greeting(now)}{name ? `, ${name}` : ''}.
          </h1>
          <p className="mt-1 max-w-2xl font-mono text-xs leading-relaxed text-[#3A3830] sm:text-sm">{headline}</p>
        </div>
        <div className="shrink-0">{scopeControls}</div>
      </div>

      <div className="grid grid-cols-2 overflow-hidden rounded-md border border-[#1C1B17] sm:grid-cols-4">
        {kpis.map((k, i) => {
          const body = (
            <>
              <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-[#6F6A60]">{k.label}</span>
              <span
                className="block font-mono text-2xl font-semibold tabular-nums sm:text-3xl"
                style={{ color: k.tone ?? '#1C1B17' }}
              >
                {k.value}
              </span>
            </>
          )
          const cls = [
            'bg-[#FBF7ED] px-3 py-2',
            i % 2 === 1 ? 'border-l border-[#D7D0C2]' : '',
            i >= 2 ? 'border-t border-[#D7D0C2] sm:border-t-0' : '',
            i === 2 ? 'sm:border-l' : '',
          ].join(' ')
          return k.href
            ? <a key={k.label} href={k.href} className={`${cls} hover:bg-[#F1EEE0]`}>{body}</a>
            : <div key={k.label} className={cls}>{body}</div>
        })}
      </div>
    </header>
  )
}
