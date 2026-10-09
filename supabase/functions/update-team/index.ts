// Edge Function: update-team
// Purpose: Rename a team (org admin, team creator, or a portfolio manager of that team)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { getMembership, isOrgAdmin, managesTeam } from '../_shared/roles.ts'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
}

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

const MAX_NAME_LENGTH = 80

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders })
    }

    try {
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)

        const token = authHeader.replace('Bearer ', '').trim()
        if (!token) return json({ error: 'Invalid Authorization header format' }, 401)

        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        if (!serviceRoleKey) {
            console.error('SUPABASE_SERVICE_ROLE_KEY not set')
            return json({ error: 'Server configuration error' }, 500)
        }

        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceRoleKey)

        // Decode JWT token to get user ID
        let userId: string | null = null
        try {
            const parts = token.split('.')
            if (parts.length === 3) {
                const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
                userId = payload.sub || payload.user_id || null
            }
        } catch (e) {
            console.error('Error decoding token:', e)
        }
        if (!userId) return json({ error: 'Invalid token format' }, 401)

        // Verify user exists
        const { data: authUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId)
        if (userError || !authUser?.user) {
            return json({ error: 'Unauthorized', details: userError?.message }, 401)
        }

        const { teamId, name } = await req.json()
        const newName = typeof name === 'string' ? name.trim() : ''
        if (!teamId || !newName) return json({ error: 'teamId and name are required' }, 400)
        if (newName.length > MAX_NAME_LENGTH) {
            return json({ error: `Team name must be ${MAX_NAME_LENGTH} characters or fewer` }, 400)
        }

        const { data: team, error: teamError } = await supabaseAdmin
            .from('teams')
            .select('id, org_id, name, created_by, created_at')
            .eq('id', teamId)
            .maybeSingle()
        if (teamError || !team) return json({ error: 'Team not found' }, 404)

        // Same rule as add-team-member: the org admin, whoever created the team, or a
        // portfolio manager who is on it. managesTeam checks team_members, not just the
        // role, so a manager of one desk cannot rename another.
        const membership = await getMembership(supabaseAdmin, userId, team.org_id)
        if (!membership) return json({ error: 'User does not belong to this organization' }, 403)

        const allowed = isOrgAdmin(membership)
            || team.created_by === userId
            || await managesTeam(supabaseAdmin, userId, team.id, membership)
        if (!allowed) {
            return json({ error: 'Only organization admins, team creators or a portfolio manager of this team can rename it' }, 403)
        }

        // Team names are unique within an organization (create-team enforces the same).
        const { data: clash, error: clashError } = await supabaseAdmin
            .from('teams')
            .select('id')
            .eq('org_id', team.org_id)
            .eq('name', newName)
            .neq('id', team.id)
            .maybeSingle()
        if (clashError) {
            console.error('Error checking existing team:', clashError)
            return json({ error: 'Failed to check team name' }, 500)
        }
        if (clash) return json({ error: 'Team name already exists in this organization' }, 400)

        const { data: updated, error: updateError } = await supabaseAdmin
            .from('teams')
            .update({ name: newName })
            .eq('id', team.id)
            .select('id, name, org_id, created_by, created_at')
            .single()
        if (updateError || !updated) {
            console.error('Error renaming team:', updateError)
            return json({ error: 'Failed to rename team', details: updateError?.message }, 500)
        }

        return json({
            success: true,
            team: {
                id: updated.id,
                name: updated.name,
                orgId: updated.org_id,
                createdBy: updated.created_by,
                createdAt: updated.created_at,
            },
        })
    } catch (error) {
        console.error('Unexpected error:', error)
        return json({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) }, 500)
    }
})
