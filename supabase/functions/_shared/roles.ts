// Organization role and team-scope checks, shared by the Edge Functions.
//
// WHY THIS EXISTS
// ---------------
// The predicate `membership.role !== 'admin'` was copy-pasted into nine functions
// with no shared helper. Adding the portfolio_manager role meant touching five of
// them, and a sixth copy of an authorisation check is how the copies start to
// disagree.
//
// The important rule is in managesTeam: a portfolio manager's authority comes from
// team_members, NOT from the role string. Trusting `role === 'portfolio_manager'`
// on its own would let any manager in the organization approve join requests and
// remove members for a desk they have nothing to do with. The role says what kind
// of user this is; team_members says which teams they may act on. Both, always.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

type SupabaseAdmin = ReturnType<typeof createClient>

export type OrgRole = 'admin' | 'analyst' | 'portfolio_manager'

export interface Membership {
    role: OrgRole
    organization_id: string
}

/**
 * The caller's membership row for one organization, or null if they are not a
 * member. Callers should treat null as 403, not 500 -- a non-member asking about
 * an organization is an authorisation failure, not a broken query.
 */
export async function getMembership(
    admin: SupabaseAdmin,
    userId: string,
    orgId: string,
): Promise<Membership | null> {
    const { data, error } = await admin
        .from('user_organization_membership')
        .select('role, organization_id')
        .eq('user_id', userId)
        .eq('organization_id', orgId)
        .maybeSingle()

    if (error || !data) return null
    return data as unknown as Membership
}

/** True when the caller administers the whole organization. */
export function isOrgAdmin(membership: Membership | null): boolean {
    return membership?.role === 'admin'
}

/**
 * True when the caller is a portfolio manager AND belongs to this specific team.
 *
 * Membership in the team is the scope. A manager of desk A gets nothing on desk B.
 */
export async function managesTeam(
    admin: SupabaseAdmin,
    userId: string,
    teamId: string,
    membership: Membership | null,
): Promise<boolean> {
    if (membership?.role !== 'portfolio_manager') return false

    const { data, error } = await admin
        .from('team_members')
        .select('user_id')
        .eq('team_id', teamId)
        .eq('user_id', userId)
        .maybeSingle()

    return !error && !!data
}

/** Every team id the user belongs to. Used to scope org-wide listings down. */
export async function teamIdsForUser(
    admin: SupabaseAdmin,
    userId: string,
): Promise<string[]> {
    const { data, error } = await admin
        .from('team_members')
        .select('team_id')
        .eq('user_id', userId)

    if (error || !data) return []
    return data.map((row: any) => row.team_id as string)
}
