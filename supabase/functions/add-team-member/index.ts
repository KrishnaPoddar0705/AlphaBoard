// Edge Function: add-team-member
// Purpose: Add a user to a team (admin or team creator only)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

        // Parse request body
        const { teamId, userId: targetUserId } = await req.json()

        // Validate input
        if (!teamId || !targetUserId) {
            return new Response(
                JSON.stringify({ error: 'teamId and userId are required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Get team and verify requester has permission
        const { data: team, error: teamError } = await supabaseAdmin
            .from('teams')
            .select('id, org_id, name, created_by')
            .eq('id', teamId)
            .maybeSingle()

        if (teamError || !team) {
            return new Response(
                JSON.stringify({ error: 'Team not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Check if requester is org admin or team creator
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
        const isTeamCreator = team.created_by === userId

        if (!isOrgAdmin && !isTeamCreator) {
            return new Response(
                JSON.stringify({ error: 'Only organization admins or team creators can add members' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Verify target user belongs to same organization
        const { data: targetMembership, error: targetMembershipError } = await supabaseAdmin
            .from('user_organization_membership')
            .select('organization_id')
            .eq('user_id', targetUserId)
            .eq('organization_id', team.org_id)
            .maybeSingle()

        if (targetMembershipError || !targetMembership) {
            return new Response(
                JSON.stringify({ error: 'Target user does not belong to the same organization' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Check if user is already a member
        const { data: existingMember, error: checkError } = await supabaseAdmin
            .from('team_members')
            .select('id')
            .eq('team_id', teamId)
            .eq('user_id', targetUserId)
            .maybeSingle()

        if (checkError) {
            console.error('Error checking existing membership:', checkError)
            return new Response(
                JSON.stringify({ error: 'Failed to check membership' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (existingMember) {
            return new Response(
                JSON.stringify({ error: 'User is already a member of this team' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Add user to team
        const { error: memberError } = await supabaseAdmin
            .from('team_members')
            .insert({
                team_id: teamId,
                user_id: targetUserId,
            })

        if (memberError) {
            console.error('Error adding user to team:', memberError)
            return new Response(
                JSON.stringify({ error: 'Failed to add member to team', details: memberError?.message }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Member added to team successfully'
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

