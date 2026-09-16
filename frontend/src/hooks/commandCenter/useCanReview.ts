import { useCallback } from 'react'
import { useCommandCenterSession } from './useCommandCenterSession'
import { useRoster } from './useHome'
import { ownerOf } from '@/lib/commandCenter/home'
import type { ActivityFeedRow } from '@/lib/commandCenter/types'

type Reviewable = Pick<ActivityFeedRow, 'created_by' | 'analyst_id' | 'is_scheduled'>

/**
 * Whether the viewer may endorse or reject a given entry -- the same rule as the
 * database (cc_can_review + the policy's no-self-review check), so the UI never offers a
 * button that would be refused:
 *   - never your own entry, and never a plan that has not happened
 *   - an org admin may review anyone else's
 *   - a portfolio manager may review people they share a team with
 */
export function useCanReview() {
  const { userId, role } = useCommandCenterSession()
  const { data: roster, isPending } = useRoster(null)
  /** A PM's answer depends on the team roster; until it loads, the answer is unknown. */
  const pending = role === 'portfolio_manager' && isPending

  const canReview = useCallback((row: Reviewable): boolean => {
    if (!userId || row.is_scheduled) return false
    const subject = ownerOf(row)
    if (subject === userId || row.created_by === userId) return false
    if (role === 'admin') return true
    if (role !== 'portfolio_manager' || !roster) return false
    const mine = roster.find((m) => m.user_id === userId)?.team_ids ?? []
    const theirs = roster.find((m) => m.user_id === subject)?.team_ids ?? []
    return theirs.some((t) => mine.includes(t))
  }, [userId, role, roster])

  return Object.assign(canReview, { pending })
}
