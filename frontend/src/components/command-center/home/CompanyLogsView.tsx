import { useMemo } from 'react'
import MatrixPopView, { type MatrixSelection } from '../matrix/MatrixPopView'
import { useCoverageEvents } from '@/hooks/commandCenter/useCommandCenterEvents'
import { readMatrixTheme } from '@/lib/commandCenter/matrix'
import type { ActivityFeedRow, CoverageBoardRow } from '@/lib/commandCenter/types'

/**
 * What to open: a company, optionally with one of its logs selected. A clicked log
 * passes itself as `entry` so it shows at once, before the company's timeline loads.
 */
export interface CompanyTarget {
  coverageId: string
  ticker: string
  companyName: string | null
  entry?: ActivityFeedRow
}

interface Props {
  target: CompanyTarget | null
  board: CoverageBoardRow[]
  onClose: () => void
  /** Comments, contacts and push stay in the entry drawer. */
  onOpenDetails: (row: ActivityFeedRow) => void
  /** Log a new entry against this company. */
  onLog: (coverageId: string) => void
}

/**
 * A company opened from the home screen, shown the way the Matrix shows a cell: centred,
 * with every log for that company down the left and the chosen one (else the newest)
 * open on the right. Opened from a log, a stock row, or a stale name in "Needs you".
 *
 * Reads the company's own timeline (one coverage), not the Matrix's year-wide window, so
 * opening one company does not pull the whole desk's history.
 */
export default function CompanyLogsView({ target, board, onClose, onOpenDetails, onLog }: Props) {
  const { data: timeline } = useCoverageEvents(target?.coverageId)

  const selection = useMemo<MatrixSelection | null>(() => {
    if (!target) return null
    // Every visible company is on the board (same RLS); the fallback only covers the
    // board still loading. MatrixPopView reads id, ticker and company_name from it.
    const stock = board.find((b) => b.id === target.coverageId)
      ?? ({ id: target.coverageId, ticker: target.ticker, company_name: target.companyName } as CoverageBoardRow)
    return {
      subject: { kind: 'stock', id: target.coverageId, title: target.ticker, stock },
      column: 'all',
      eventId: target.entry?.event_id,
    }
  }, [target, board])

  // A clicked log shows at once; the rest of the company's timeline fills in around it.
  const entries = useMemo(() => {
    if (!target) return []
    const seed = target.entry
    const rows = !seed || timeline?.some((r) => r.event_id === seed.event_id)
      ? timeline ?? []
      : [seed, ...(timeline ?? [])]
    return [...rows].sort((a, b) => b.event_date.localeCompare(a.event_date))
  }, [target, timeline])

  return (
    <MatrixPopView
      key={target ? `${target.coverageId}:${target.entry?.event_id ?? ''}` : 'closed'}
      selection={selection}
      entries={entries}
      theme={readMatrixTheme()}
      onClose={onClose}
      onOpenEntry={onOpenDetails}
      onLog={(coverageId) => { if (coverageId) { onClose(); onLog(coverageId) } }}
    />
  )
}
