// Edge Function: get-team-members
// Purpose: Get all members of a team

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, origin',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders
        })
    }

    try {
        // Get authorization header
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Missing Authorization header' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Extract token from Authorization header
        const token = authHeader.replace('Bearer ', '').trim()
        if (!token) {
            return new Response(
                JSON.stringify({ error: 'Invalid Authorization header format' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Get service role key for database operations
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        if (!serviceRoleKey) {
            console.error('SUPABASE_SERVICE_ROLE_KEY not set')
            return new Response(
                JSON.stringify({ error: 'Server configuration error' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            serviceRoleKey,
        )

        // Decode JWT token to get user ID
        let userId: string | null = null
        try {
            const parts = token.split('.')
            if (parts.length === 3) {
                const payload = JSON.parse(
                    atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
                )
                userId = payload.sub || payload.user_id || null
            }
        } catch (e) {
            console.error('Error decoding token:', e)
        }

        if (!userId) {
            return new Response(
                JSON.stringify({ error: 'Invalid token format' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Verify user exists
        const { data: authUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId)
        if (userError || !authUser?.user) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized', details: userError?.message }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Get teamId from query params
        const url = new URL(req.url)
        const teamId = url.searchParams.get('teamId')

        if (!teamId) {
            return new Response(
                JSON.stringify({ error: 'teamId query parameter is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Get team and verify user has access
        const { data: team, error: teamError } = await supabaseAdmin
            .from('teams')
            .select('id, org_id, name')
            .eq('id', teamId)
            .maybeSingle()

        if (teamError || !team) {
            return new Response(
                JSON.stringify({ error: 'Team not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Check if user is team member or org admin
        const { data: membership, error: membershipError } = await supabaseAdmin
            .from('user_organization_membership')
            .select('role')
            .eq('user_id', userId)
            .eq('organization_id', team.org_id)
            .maybeSingle()

        if (membershipError || !membership) {
            return new Response(
                JSON.stringify({ error: 'User does not belong to this organization' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const isOrgAdmin = membership.role === 'admin'

        // Check if user is team member (if not admin)
        if (!isOrgAdmin) {
            const { data: teamMember, error: memberCheckError } = await supabaseAdmin
                .from('team_members')
                .select('id')
                .eq('team_id', teamId)
                .eq('user_id', userId)
                .maybeSingle()

            if (memberCheckError || !teamMember) {
                return new Response(
                    JSON.stringify({ error: 'User is not a member of this team' }),
                    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }
        }

        // Get team members
        const { data: teamMembersData, error: membersError } = await supabaseAdmin
            .from('team_members')
            .select('id, user_id, created_at')
            .eq('team_id', teamId)
            .order('created_at', { ascending: true })

        if (membersError) {
            console.error('Error fetching team members:', membersError)
            return new Response(
                JSON.stringify({ error: 'Failed to fetch team members', details: membersError?.message }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Fetch profiles for each member
        const userIds = teamMembersData?.map((tm: any) => tm.user_id) || []
        let profilesMap: Record<string, any> = {}

        if (userIds.length > 0) {
            const { data: profilesData, error: profilesError } = await supabaseAdmin
                .from('profiles')
                .select('id, username, email')
                .in('id', userIds)

            if (!profilesError && profilesData) {
                profilesData.forEach((profile: any) => {
                    profilesMap[profile.id] = profile
                })
            }
        }

        // Combine team members with their profiles
        const members = (teamMembersData || []).map((tm: any) => ({
            id: tm.id,
            userId: tm.user_id,
            joinedAt: tm.created_at,
            profile: profilesMap[tm.user_id] ? {
                id: profilesMap[tm.user_id].id,
                username: profilesMap[tm.user_id].username,
                email: profilesMap[tm.user_id].email,
            } : null,
        }))

        return new Response(
            JSON.stringify({
                success: true,
                team: {
                    id: team.id,
                    name: team.name,
                    orgId: team.org_id,
                },
                members: members
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Unexpected error:', error)
        return new Response(
            JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})

