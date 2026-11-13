import type { ReactNode } from 'react'

interface Props {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
}

/** The paper-themed panel every right-rail section on the stock page sits in. */
export default function SectionCard({ title, action, children, className = '' }: Props) {
  return (
    <section
      className={`rounded-xl border border-border-editorial bg-paper-light ${className}`}
    >
      <header className="flex items-center justify-between gap-2 border-b border-gridline px-4 py-2.5">
        <h2 className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">
          {title}
        </h2>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}
