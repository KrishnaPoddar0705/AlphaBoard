// Edge Function: create-team
// Purpose: Create a new team within an organization
// Any organization member can create teams

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
        const { orgId, name } = await req.json()

        // Validate input
        if (!orgId || !name || typeof name !== 'string' || name.trim().length === 0) {
            return new Response(
                JSON.stringify({ error: 'orgId and name are required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Verify user belongs to organization
        const { data: membership, error: membershipError } = await supabaseAdmin
            .from('user_organization_membership')
            .select('organization_id, role')
            .eq('user_id', userId)
            .eq('organization_id', orgId)
            .maybeSingle()

        if (membershipError || !membership) {
            return new Response(
                JSON.stringify({ error: 'User does not belong to this organization' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Verify organization exists
        const { data: org, error: orgError } = await supabaseAdmin
            .from('organizations')
            .select('id, name')
            .eq('id', orgId)
            .maybeSingle()

        if (orgError || !org) {
            return new Response(
                JSON.stringify({ error: 'Organization not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Check if team name already exists in org
        const { data: existingTeam, error: checkError } = await supabaseAdmin
            .from('teams')
            .select('id')
            .eq('org_id', orgId)
            .eq('name', name.trim())
            .maybeSingle()

        if (checkError) {
            console.error('Error checking existing team:', checkError)
            return new Response(
                JSON.stringify({ error: 'Failed to check team name' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (existingTeam) {
            return new Response(
                JSON.stringify({ error: 'Team name already exists in this organization' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Create team
        const { data: team, error: teamError } = await supabaseAdmin
            .from('teams')
            .insert({
                org_id: orgId,
                name: name.trim(),
                created_by: userId,
            })
            .select()
            .single()

        if (teamError || !team) {
            console.error('Error creating team:', teamError)
            return new Response(
                JSON.stringify({ error: 'Failed to create team', details: teamError?.message }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Add creator as team member
        const { error: memberError } = await supabaseAdmin
            .from('team_members')
            .insert({
                team_id: team.id,
                user_id: userId,
            })

        if (memberError) {
            console.error('Error adding creator to team:', memberError)
            // Try to delete the team if adding member fails
            await supabaseAdmin.from('teams').delete().eq('id', team.id)
            return new Response(
                JSON.stringify({ error: 'Failed to add creator to team', details: memberError?.message }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        return new Response(
            JSON.stringify({
                success: true,
                team: {
                    id: team.id,
                    name: team.name,
                    orgId: team.org_id,
                    createdAt: team.created_at,
                }
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

