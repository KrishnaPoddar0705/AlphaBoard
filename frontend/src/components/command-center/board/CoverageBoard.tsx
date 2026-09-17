import { Radar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCoverageBoard } from '@/hooks/commandCenter/useCoverage'
import CoverageLayout from './CoverageLayout'
import EmptyState from '../shared/EmptyState'

/**
 * The Coverage tab with nothing selected yet.
 *
 * The rail is the view now; this pane only says what to do with it. Picking a name
 * navigates to /command-center/stock/:ticker, which renders the same rail beside the
 * research, so the list never disappears while reading.
 */
export default function CoverageBoard({ onAdd }: { onAdd: () => void }) {
  const { data, isPending, isError, error } = useCoverageBoard()
  const empty = !isPending && !isError && (data?.length ?? 0) === 0

  if (isError) {
    return (
      <EmptyState
        title="Couldn't load coverage"
        hint={error instanceof Error ? error.message : undefined}
      />
    )
  }

  if (empty) {
    return (
      <EmptyState
        icon={Radar}
        title="No stocks tracked yet"
        hint="Add the names in your sector. Everything you log against them -- meetings, concalls, broker reports -- lives on their page."
        action={<Button size="sm" onClick={onAdd}>Add a stock</Button>}
      />
    )
  }

  return (
    <CoverageLayout onAdd={onAdd}>
      <div className="flex min-h-[40vh] items-center justify-center rounded-xl border border-dashed border-[#D7D0C2] p-8">
        <p className="max-w-xs text-center font-mono text-[11px] leading-relaxed text-[#8B857A]">
          Pick a stock to read everything the desk knows about it — the timeline,
          contacts, concall and annual-report tracking, and broker coverage.
        </p>
      </div>
    </CoverageLayout>
  )
}
