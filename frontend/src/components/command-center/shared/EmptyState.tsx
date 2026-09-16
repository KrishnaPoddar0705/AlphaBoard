import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface Props {
  icon?: LucideIcon
  title: string
  hint?: string
  action?: ReactNode
}

export default function EmptyState({ icon: Icon, title, hint, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      {Icon && <Icon className="h-6 w-6 text-[#8B857A]" />}
      <p className="font-mono text-sm text-[#1C1B17]">{title}</p>
      {hint && <p className="max-w-sm font-mono text-xs text-[#6F6A60]">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
