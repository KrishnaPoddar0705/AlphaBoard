// Edge Function: get-team-join-requests
// Purpose: Get pending team join requests for an organization (admin only)

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

        // Get orgId from query params
        const url = new URL(req.url)
        const orgId = url.searchParams.get('orgId')

        if (!orgId) {
            return new Response(
                JSON.stringify({ error: 'orgId query parameter is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Verify user is admin of the organization
        const { data: membership, error: membershipError } = await supabaseAdmin
            .from('user_organization_membership')
            .select('role')
            .eq('user_id', userId)
            .eq('organization_id', orgId)
            .maybeSingle()

        if (membershipError || !membership || membership.role !== 'admin') {
            return new Response(
                JSON.stringify({ error: 'Only organization admins can view join requests' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // First get all teams in the organization
        const { data: orgTeams, error: teamsError } = await supabaseAdmin
            .from('teams')
            .select('id')
            .eq('org_id', orgId)

        if (teamsError || !orgTeams || orgTeams.length === 0) {
            return new Response(
                JSON.stringify({
                    success: true,
                    requests: []
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const teamIds = orgTeams.map((t: any) => t.id)

        // Get all pending join requests for teams in this organization
        const { data: requests, error: requestsError } = await supabaseAdmin
            .from('team_join_requests')
            .select('id, team_id, user_id, status, requested_at')
            .eq('status', 'pending')
            .in('team_id', teamIds)
            .order('requested_at', { ascending: false })

        if (requestsError) {
            console.error('Error fetching join requests:', requestsError)
            return new Response(
                JSON.stringify({ error: 'Failed to fetch join requests', details: requestsError?.message }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Fetch team and profile data separately
        const requestTeamIds = [...new Set((requests || []).map((r: any) => r.team_id))]
        const requestUserIds = [...new Set((requests || []).map((r: any) => r.user_id))]

        // Fetch teams
        const { data: teamsData } = await supabaseAdmin
            .from('teams')
            .select('id, name')
            .in('id', requestTeamIds)

        // Fetch profiles
        const { data: profilesData } = await supabaseAdmin
            .from('profiles')
            .select('id, username, email')
            .in('id', requestUserIds)

        const teamsMap = new Map((teamsData || []).map((t: any) => [t.id, t]))
        const profilesMap = new Map((profilesData || []).map((p: any) => [p.id, p]))

        const formattedRequests = (requests || []).map((req: any) => {
            const team = teamsMap.get(req.team_id)
            const profile = profilesMap.get(req.user_id)
            return {
                id: req.id,
                teamId: req.team_id,
                teamName: team?.name || 'Unknown Team',
                userId: req.user_id,
                username: profile?.username || 'Unknown User',
                email: profile?.email || null,
                requestedAt: req.requested_at,
            }
        })

        return new Response(
            JSON.stringify({
                success: true,
                requests: formattedRequests
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

