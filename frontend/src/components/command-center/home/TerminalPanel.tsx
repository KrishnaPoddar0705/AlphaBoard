import type { ReactNode } from 'react'

interface Props {
  /** Three- or four-letter mnemonic, terminal style: CHG, ATTN, CAL. */
  code: string
  title: string
  count?: number
  /** Highlights the count when there is something to act on. */
  alert?: boolean
  action?: ReactNode
  children: ReactNode
  className?: string
  id?: string
}

/** The ink-headed panel every home section sits in. Dense, ruled, paper underneath. */
export default function TerminalPanel({ code, title, count, alert, action, children, className = '', id }: Props) {
  return (
    <section
      id={id}
      className={`flex min-w-0 flex-col overflow-hidden rounded-md border border-ink bg-paper-alt board:rounded-2xl board:border-transparent ${className}`}
    >
      <header className="flex items-center gap-2 bg-ink px-3 py-1.5 text-paper board:bg-none board:bg-transparent board:px-4 board:pt-3.5 board:pb-2.5 board:text-ink">
        <span className="font-mono text-[10px] font-semibold tracking-[0.12em] text-chart-orange board:hidden">{code}</span>
        <h2 className="truncate font-mono text-[11px] font-semibold uppercase tracking-[0.12em] board:text-sm board:font-semibold">{title}</h2>
        {count !== undefined && (
          <span
            className={[
              'rounded px-1.5 font-mono text-[10px] tabular-nums board:rounded-md board:py-0.5 board:text-xs board:font-medium',
              alert && count > 0 ? 'bg-chart-orange text-ink board:bg-rose-100 board:text-rose-700' : 'bg-[#3A3830] text-paper board:bg-border-editorial board:text-ink-muted',
            ].join(' ')}
          >
            {count}
          </span>
        )}
        {action && <div className="ml-auto flex items-center gap-1">{action}</div>}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto board:mx-1.5 board:mb-1.5 board:rounded-xl board:bg-paper-light board:shadow-card">{children}</div>
    </section>
  )
}

/** One quiet line explaining why a panel is empty. Never placeholder data. */
export function PanelEmpty({ children }: { children: ReactNode }) {
  return <p className="px-3 py-4 font-mono text-[11px] text-ink-faint board:px-4 board:py-6 board:text-center board:text-sm board:text-ink-muted">{children}</p>
}
