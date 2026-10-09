import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCommandCenterSession } from './useCommandCenterSession'
import { useMyTeams, useRoster } from './useHome'
import type { Lens } from '@/components/command-center/home/LensBar'
import type { RosterMember, TeamOption } from '@/lib/commandCenter/types'

export interface HomeScope {
  scope: string
  lens: Lens
  person: string | null
  personName: string | null
  teams: TeamOption[]
  /** Everyone the scope covers, or null when the roster is unavailable (migration pending). */
  roster: RosterMember[] | null
  /** Filter for the home window; null = everything RLS lets the caller see. */
  userIds: string[] | null
  /** Waits for the team roster before querying a team scope. */
  ready: boolean
  /** "The desk" / "Your team" / "You" / a name -- for the headline. */
  subject: string
  viewerName: string | null
  setScope: (scope: string) => void
  setLens: (lens: Lens) => void
  setPerson: (userId: string | null) => void
}

/**
 * Who the home screen is about, kept in the URL (?scope=&lens=&person=) so a PM can
 * bookmark "my team, by analyst".
 *
 *   scope=all     everything the database lets this user see (org / their teams)
 *   scope=mine    only the viewer's own entries
 *   scope=<team>  one team's members
 *   person=<id>   narrows any scope to one person
 */
export function useHomeScope(): HomeScope {
  const { userId, role } = useCommandCenterSession()
  const [params, setParams] = useSearchParams()
  const scope = params.get('scope') || 'all'
  const lens: Lens = params.get('lens') === 'analyst' ? 'analyst' : 'stock'
  const person = params.get('person')

  const teamId = scope !== 'all' && scope !== 'mine' ? scope : null
  const { data: teams = [] } = useMyTeams()
  const { data: visibleRoster, isFetched: visibleFetched } = useRoster(null)
  const { data: teamRoster, isFetched: teamFetched } = useRoster(teamId)

  const update = (key: string, value: string | null, fallback?: string) => {
    const next = new URLSearchParams(params)
    if (!value || value === fallback) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  return useMemo(() => {
    const base = teamId ? teamRoster ?? null : visibleRoster ?? null
    let roster = base
    if (scope === 'mine' && userId) roster = base ? base.filter((m) => m.user_id === userId) : null
    if (person) roster = base ? base.filter((m) => m.user_id === person) : null

    let userIds: string[] | null = null
    if (person) userIds = [person]
    else if (scope === 'mine' && userId) userIds = [userId]
    else if (teamId) userIds = (teamRoster ?? []).map((m) => m.user_id)

    const find = (id: string | null) => visibleRoster?.find((m) => m.user_id === id)?.username ?? null
    const personName = person ? find(person) ?? 'Selected analyst' : null
    const team = teams.find((t) => t.id === teamId)

    const subject = personName ?? (scope === 'mine' ? 'You'
      : team ? team.name
      : role === 'admin' ? 'The desk' : 'Your team')

    return {
      scope, lens, person, personName, teams, roster, userIds, subject,
      viewerName: find(userId),
      ready: teamId ? teamFetched : visibleFetched || !!person || scope === 'mine',
      setScope: (s: string) => {
        const next = new URLSearchParams(params)
        if (s === 'all') next.delete('scope'); else next.set('scope', s)
        next.delete('person')
        setParams(next, { replace: true })
      },
      setLens: (l: Lens) => update('lens', l, 'stock'),
      setPerson: (id: string | null) => update('person', id),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, lens, person, teamId, teams, teamRoster, visibleRoster, teamFetched, visibleFetched, userId, role, params])
}
