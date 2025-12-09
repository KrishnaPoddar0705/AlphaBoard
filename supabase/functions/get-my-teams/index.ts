// Edge Function: get-my-teams
// Purpose: Get all teams the current user belongs to in their organization

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

        // Get user's organization
        const { data: membership, error: membershipError } = await supabaseAdmin
            .from('user_organization_membership')
            .select('organization_id, role')
            .eq('user_id', userId)
            .maybeSingle()

        if (membershipError || !membership) {
            // User has no organization - return empty array
            return new Response(
                JSON.stringify({
                    success: true,
                    teams: []
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Get all teams user belongs to in their organization
        const { data: teamMemberships, error: teamsError } = await supabaseAdmin
            .from('team_members')
            .select('team_id')
            .eq('user_id', userId)

        if (teamsError) {
            console.error('Error fetching teams:', teamsError)
            return new Response(
                JSON.stringify({ error: 'Failed to fetch teams', details: teamsError?.message }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Get team IDs
        const teamIds = teamMemberships?.map((tm: any) => tm.team_id) || []

        if (teamIds.length === 0) {
            return new Response(
                JSON.stringify({
                    success: true,
                    teams: []
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Fetch teams that belong to user's organization
        const { data: teamsData, error: teamsDataError } = await supabaseAdmin
            .from('teams')
            .select('id, name, org_id, created_by, created_at')
            .in('id', teamIds)
            .eq('org_id', membership.organization_id)

        if (teamsDataError) {
            console.error('Error fetching teams data:', teamsDataError)
            return new Response(
                JSON.stringify({ error: 'Failed to fetch teams data', details: teamsDataError?.message }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const orgTeams = (teamsData || []).map((t: any) => ({
            id: t.id,
            name: t.name,
            orgId: t.org_id,
            createdBy: t.created_by,
            createdAt: t.created_at,
        }))

        return new Response(
            JSON.stringify({
                success: true,
                teams: orgTeams
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

