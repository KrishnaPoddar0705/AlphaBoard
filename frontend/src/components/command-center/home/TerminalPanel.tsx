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
      className={`flex min-w-0 flex-col overflow-hidden rounded-md border border-[#1C1B17] bg-[#FBF7ED] ${className}`}
    >
      <header className="flex items-center gap-2 bg-[#1C1B17] px-3 py-1.5 text-[#F1EEE0]">
        <span className="font-mono text-[10px] font-semibold tracking-[0.12em] text-[#D06030]">{code}</span>
        <h2 className="truncate font-mono text-[11px] font-semibold uppercase tracking-[0.12em]">{title}</h2>
        {count !== undefined && (
          <span
            className={[
              'rounded px-1.5 font-mono text-[10px] tabular-nums',
              alert && count > 0 ? 'bg-[#D06030] text-[#1C1B17]' : 'bg-[#3A3830] text-[#F1EEE0]',
            ].join(' ')}
          >
            {count}
          </span>
        )}
        {action && <div className="ml-auto flex items-center gap-1">{action}</div>}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </section>
  )
}

/** One quiet line explaining why a panel is empty. Never placeholder data. */
export function PanelEmpty({ children }: { children: ReactNode }) {
  return <p className="px-3 py-4 font-mono text-[11px] text-[#8B857A]">{children}</p>
}
