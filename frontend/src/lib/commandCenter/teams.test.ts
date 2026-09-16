import { describe, it, expect } from 'vitest'
import { leadCandidates, stockTeams } from './teams'
import type { RosterMember, TeamOption } from './types'

const teams: TeamOption[] = [
  { id: 'auto', name: 'Auto', is_manager: true, member_count: 3 },
  { id: 'bank', name: 'Banks', is_manager: false, member_count: 2 },
]
const roster: RosterMember[] = [
  { user_id: 'aditi', username: 'Aditi', role: 'analyst', team_ids: ['auto'] },
  { user_id: 'rahul', username: 'Rahul', role: 'analyst', team_ids: ['auto', 'bank'] },
  { user_id: 'pm1', username: 'Neha', role: 'portfolio_manager', team_ids: ['auto'] },
  { user_id: 'solo', username: 'Solo', role: 'analyst', team_ids: [] },
]

describe('stockTeams', () => {
  it("uses the lead analyst's teams and names each team's PMs", () => {
    expect(stockTeams({ lead_analyst_id: 'rahul', created_by: 'aditi' }, roster, teams)).toEqual([
      { id: 'auto', name: 'Auto', pms: ['Neha'] },
      { id: 'bank', name: 'Banks', pms: [] },
    ])
  })

  it('falls back to whoever added the stock when there is no lead', () => {
    expect(stockTeams({ lead_analyst_id: null, created_by: 'aditi' }, roster, teams).map((t) => t.id))
      .toEqual(['auto'])
  })

  it('returns nothing for an owner on no team, or one the viewer cannot see', () => {
    expect(stockTeams({ lead_analyst_id: 'solo', created_by: 'solo' }, roster, teams)).toEqual([])
    expect(stockTeams({ lead_analyst_id: 'stranger', created_by: 'stranger' }, roster, teams)).toEqual([])
  })

  it('returns nothing before the roster or team list is available', () => {
    expect(stockTeams({ lead_analyst_id: 'aditi', created_by: 'aditi' }, null, teams)).toEqual([])
    expect(stockTeams({ lead_analyst_id: 'aditi', created_by: 'aditi' }, roster, [])).toEqual([])
  })
})

describe('leadCandidates', () => {
  const people: RosterMember[] = [
    ...roster,
    { user_id: 'boss', username: 'Boss', role: 'admin', team_ids: ['auto'] },
    { user_id: 'other', username: 'Other', role: 'analyst', team_ids: ['bank'] },
  ]

  it("offers the adder plus analysts and PMs on the adder's teams, not admins", () => {
    expect(leadCandidates({ created_by: 'aditi', lead_analyst_id: 'aditi' }, people).map((m) => m.user_id))
      .toEqual(['aditi', 'pm1', 'rahul'])
  })

  it("covers every team the adder is on", () => {
    expect(leadCandidates({ created_by: 'rahul', lead_analyst_id: null }, people).map((m) => m.user_id))
      .toEqual(['aditi', 'pm1', 'other', 'rahul'])
  })

  it('keeps an existing lead from outside the rule so it still shows as selected', () => {
    expect(leadCandidates({ created_by: 'solo', lead_analyst_id: 'other' }, people).map((m) => m.user_id))
      .toEqual(['other', 'solo'])
  })

  it('returns nothing until the roster loads', () => {
    expect(leadCandidates({ created_by: 'aditi', lead_analyst_id: null }, null)).toEqual([])
  })
})
