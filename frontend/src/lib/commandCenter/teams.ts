import type { CoverageBoardRow, RosterMember, TeamOption } from './types'

export interface StockTeam {
  id: string
  name: string
  /** Portfolio managers on the team, by username. */
  pms: string[]
}

/**
 * The team(s) a covered stock belongs to.
 *
 * Coverage has no team column: a stock sits with whoever owns it -- its lead analyst,
 * or failing that whoever added it -- so its teams are that person's teams. Only teams
 * and people the viewer can see are returned (the roster is already scoped by RLS).
 */
export function stockTeams(
  row: Pick<CoverageBoardRow, 'lead_analyst_id' | 'created_by'>,
  roster: RosterMember[] | null | undefined,
  teams: TeamOption[] | null | undefined,
): StockTeam[] {
  if (!roster || !teams?.length) return []
  const ownerId = row.lead_analyst_id ?? row.created_by
  const owner = roster.find((m) => m.user_id === ownerId)
  if (!owner) return []

  return owner.team_ids
    .map((teamId) => teams.find((t) => t.id === teamId))
    .filter((t): t is TeamOption => !!t)
    .map((t) => ({
      id: t.id,
      name: t.name,
      pms: roster
        .filter((m) => m.role === 'portfolio_manager' && m.team_ids.includes(t.id))
        .map((m) => m.username ?? 'Unknown'),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Who may lead a covered stock: whoever added it, or an analyst or portfolio manager who
 * shares a team with them. The same rule the database enforces on save
 * (migration_command_center_lead_analyst.sql). The current lead is always included so an
 * older assignment that predates the rule still shows as selected.
 */
export function leadCandidates(
  row: Pick<CoverageBoardRow, 'lead_analyst_id' | 'created_by'>,
  roster: RosterMember[] | null | undefined,
): RosterMember[] {
  if (!roster) return []
  const creator = roster.find((m) => m.user_id === row.created_by)
  const creatorTeams = creator?.team_ids ?? []

  return roster
    .filter((m) =>
      m.user_id === row.created_by
      || m.user_id === row.lead_analyst_id
      || ((m.role === 'analyst' || m.role === 'portfolio_manager')
        && m.team_ids.some((t) => creatorTeams.includes(t))))
    .sort((a, b) => (a.username ?? '').localeCompare(b.username ?? ''))
}
