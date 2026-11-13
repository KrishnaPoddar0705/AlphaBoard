import { Link } from 'react-router-dom'
import { PenLine } from 'lucide-react'
import { usePublishedBoardId } from '@/hooks/commandCenter/useBoards'

/**
 * "Open in Thinking Board" on a log entry that was published from a board -- shown only
 * to the board's author, since drafts are private to them.
 */
export default function BoardLink({ eventId, className = '' }: { eventId: string; className?: string }) {
  const boardId = usePublishedBoardId(eventId)
  if (!boardId) return null
  return (
    <Link
      to={`/command-center?view=thinking&note=${boardId}`}
      className={`inline-flex items-center gap-1.5 self-start rounded-md border border-border-editorial bg-paper-alt px-2 py-1 font-mono text-[11px] text-ink hover:border-ink ${className}`}
    >
      <PenLine className="h-3 w-3" /> Open in Thinking Board
    </Link>
  )
}
