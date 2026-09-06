// Edge Function: set-recommendation-teams
// Purpose: Replace the set of teams a recommendation is tagged to (owner only).
//
// WHY THIS IS AN EDGE FUNCTION
// ----------------------------
// The two obvious alternatives both fail on authorisation:
//   - The FastAPI create path (backend/app/main.py) has no authentication at all --
//     it reads user_id straight from the request body -- so writing tags there would
//     let anyone tag anything into any team.
//   - A direct client upsert would satisfy the owner-only RLS on recommendation_teams,
//     but RLS cannot also enforce "and only into teams you belong to" without a
//     second policy, and splitting one rule across two places is how they drift.
// So the rule lives here, once: you own the recommendation, and every team you name
// is a team you are a member of.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { teamIdsForUser } from '../_shared/roles.ts'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders })
    }

    try {
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Missing Authorization header' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const token = authHeader.replace('Bearer ', '').trim()
        if (!token) {
            return new Response(
                JSON.stringify({ error: 'Invalid Authorization header format' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

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

        const { data: authUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId)
        if (userError || !authUser?.user) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized', details: userError?.message }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const { recommendationId, teamIds } = await req.json()

        if (!recommendationId || !Array.isArray(teamIds)) {
            return new Response(
                JSON.stringify({ error: 'recommendationId and teamIds[] are required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Duplicates in the request would only collide on the composite primary key,
        // so collapse them before we count or insert anything.
        const requested: string[] = [...new Set(teamIds.filter((id: unknown) => typeof id === 'string'))]

        // Only the author may tag their own work. Portfolio managers are view-only
        // over other people's recommendations.
        const { data: recommendation, error: recError } = await supabaseAdmin
            .from('recommendations')
            .select('id, user_id')
            .eq('id', recommendationId)
            .maybeSingle()

        if (recError || !recommendation) {
            return new Response(
                JSON.stringify({ error: 'Recommendation not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if ((recommendation as any).user_id !== userId) {
            return new Response(
                JSON.stringify({ error: 'You can only change teams on your own recommendations' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Every named team must be one the author actually belongs to. Without this
        // an analyst could push an idea onto a desk they have no relationship with,
        // and it would show up on that desk's Team Dashboard.
        const ownTeamIds = await teamIdsForUser(supabaseAdmin, userId)
        const notMine = requested.filter((id) => !ownTeamIds.includes(id))
        if (notMine.length > 0) {
            return new Response(
                JSON.stringify({ error: 'You can only tag teams you belong to', teamIds: notMine }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Replace the set. Clearing first keeps this a true "set to exactly these",
        // which is what an unticked checkbox has to mean.
        const { error: deleteError } = await supabaseAdmin
            .from('recommendation_teams')
            .delete()
            .eq('recommendation_id', recommendationId)

        if (deleteError) {
            console.error('Error clearing recommendation teams:', deleteError)
            return new Response(
                JSON.stringify({ error: 'Failed to update teams', details: deleteError.message }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (requested.length > 0) {
            const { error: insertError } = await supabaseAdmin
                .from('recommendation_teams')
                .insert(requested.map((teamId) => ({
                    recommendation_id: recommendationId,
                    team_id: teamId,
                })))

            if (insertError) {
                console.error('Error inserting recommendation teams:', insertError)
                return new Response(
                    JSON.stringify({ error: 'Failed to update teams', details: insertError.message }),
                    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }
        }

        return new Response(
            JSON.stringify({ success: true, recommendationId, teamIds: requested }),
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
