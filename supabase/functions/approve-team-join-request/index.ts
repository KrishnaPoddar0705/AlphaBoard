// Edge Function: approve-team-join-request
// Purpose: Approve a team join request (org admin, or a portfolio manager of that team)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { getMembership, isOrgAdmin, managesTeam } from '../_shared/roles.ts'

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
        const { requestId } = await req.json()

        // Validate input
        if (!requestId) {
            return new Response(
                JSON.stringify({ error: 'requestId is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Get join request
        const { data: joinRequest, error: requestError } = await supabaseAdmin
            .from('team_join_requests')
            .select('id, team_id, user_id, status, teams(id, org_id, name)')
            .eq('id', requestId)
            .maybeSingle()

        if (requestError || !joinRequest) {
            return new Response(
                JSON.stringify({ error: 'Join request not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (joinRequest.status !== 'pending') {
            return new Response(
                JSON.stringify({ error: 'Join request has already been processed' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const team = joinRequest.teams as any

        // Org admins may act anywhere; a portfolio manager only on desks they are
        // actually on. The team_members lookup inside managesTeam is the scope --
        // the role string alone would let any manager act on any team in the org.
        const membership = await getMembership(supabaseAdmin, userId, team.org_id)

        if (!isOrgAdmin(membership) && !(await managesTeam(supabaseAdmin, userId, team.id, membership))) {
            return new Response(
                JSON.stringify({ error: 'Only organization admins or a portfolio manager of this team can approve join requests' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Check if user is already a member
        const { data: existingMember } = await supabaseAdmin
            .from('team_members')
            .select('id')
            .eq('team_id', joinRequest.team_id)
            .eq('user_id', joinRequest.user_id)
            .maybeSingle()

        if (existingMember) {
            // User is already a member, just update the request status
            await supabaseAdmin
                .from('team_join_requests')
                .update({
                    status: 'approved',
                    reviewed_at: new Date().toISOString(),
                    reviewed_by: userId,
                })
                .eq('id', requestId)

            return new Response(
                JSON.stringify({
                    success: true,
                    message: 'User is already a member of this team'
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Add user to team
        const { error: memberError } = await supabaseAdmin
            .from('team_members')
            .insert({
                team_id: joinRequest.team_id,
                user_id: joinRequest.user_id,
            })

        if (memberError) {
            console.error('Error adding user to team:', memberError)
            return new Response(
                JSON.stringify({ error: 'Failed to add user to team', details: memberError?.message }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Update request status
        const { error: updateError } = await supabaseAdmin
            .from('team_join_requests')
            .update({
                status: 'approved',
                reviewed_at: new Date().toISOString(),
                reviewed_by: userId,
            })
            .eq('id', requestId)

        if (updateError) {
            console.error('Error updating request status:', updateError)
            // Don't fail the request if status update fails
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: `Successfully approved join request for team "${team.name}"`
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


