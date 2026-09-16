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
      className={`rounded-xl border border-[#D7D0C2] bg-[#F7F2E6] ${className}`}
    >
      <header className="flex items-center justify-between gap-2 border-b border-[#E3DDCF] px-4 py-2.5">
        <h2 className="font-mono text-[11px] uppercase tracking-wider text-[#6F6A60]">
          {title}
        </h2>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}
