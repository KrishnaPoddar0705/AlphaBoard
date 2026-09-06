// Edge Function: get-visible-recommendations
// Purpose: Get all recommendations visible to the current user (RLS-enforced)
// Returns recommendations based on team membership and admin status

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// Ceiling on the untagged-recommendation scan below. Raise it, or move the whole
// team query into a SQL function called through .rpc(), if a single team ever holds
// more recommendations than this.
const UNTAGGED_SCAN_LIMIT = 5000

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

        // Create Supabase client with user's token (RLS will be enforced)
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

        const supabaseClient = createClient(
            supabaseUrl,
            supabaseAnonKey,
            {
                global: {
                    headers: { Authorization: authHeader },
                },
            }
        )

        // Verify user is authenticated
        const {
            data: { user },
            error: authError,
        } = await supabaseClient.auth.getUser()

        if (authError || !user) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized', details: authError?.message }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Get optional query parameters
        const url = new URL(req.url)
        const teamId = url.searchParams.get('teamId')
        const status = url.searchParams.get('status') // 'OPEN', 'CLOSED', 'WATCHLIST', or null for all

        // Build query - RLS will automatically filter based on team membership
        let query = supabaseClient
            .from('recommendations')
            .select('*')
            .order('entry_date', { ascending: false })

        // Apply status filter if provided
        if (status) {
            query = query.eq('status', status)
        }

        // If teamId is provided, restrict to the recommendations tagged to that team.
        //
        // Tags are the source of truth, with one fallback: a recommendation that has
        // never been tagged at all belongs to every team its author is currently in.
        // Without that, the entire history that predates tagging -- and anything an
        // analyst forgets to tick -- would vanish from every Team Dashboard.
        if (teamId) {
            const { data: taggedRows, error: taggedError } = await supabaseClient
                .from('recommendation_teams')
                .select('recommendation_id')
                .eq('team_id', teamId)

            if (taggedError) {
                console.error('Error fetching recommendation teams:', taggedError)
                return new Response(
                    JSON.stringify({ error: 'Failed to fetch team recommendations', details: taggedError?.message }),
                    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            const { data: teamMembers, error: membersError } = await supabaseClient
                .from('team_members')
                .select('user_id')
                .eq('team_id', teamId)

            if (membersError) {
                console.error('Error fetching team members:', membersError)
                return new Response(
                    JSON.stringify({ error: 'Failed to fetch team members', details: membersError?.message }),
                    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            const recIds = new Set((taggedRows || []).map((r: any) => r.recommendation_id))
            const memberIds = (teamMembers || []).map((m: any) => m.user_id)

            // The untagged fallback. PostgREST has no NOT EXISTS, so this is a
            // fetch-and-subtract: take the members' recommendation ids, take every
            // tag row for those ids, and keep the ids that appear in neither.
            // Scoped to one team's members, so the id lists stay small.
            if (memberIds.length > 0) {
                const { data: memberRecs, error: memberRecsError } = await supabaseClient
                    .from('recommendations')
                    .select('id')
                    .in('user_id', memberIds)
                    // Explicit, because PostgREST's default cap is 1000 and it
                    // truncates silently. After the backfill almost everything is
                    // tagged, so this scan only exists for rows created between the
                    // migration and the frontend deploy -- but a team that does
                    // outgrow this would lose untagged rows with no error, so make
                    // the ceiling visible rather than implicit.
                    .limit(UNTAGGED_SCAN_LIMIT)

                if (memberRecsError) {
                    console.error('Error fetching member recommendations:', memberRecsError)
                    return new Response(
                        JSON.stringify({ error: 'Failed to fetch team recommendations', details: memberRecsError?.message }),
                        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    )
                }

                const memberRecIds = (memberRecs || []).map((r: any) => r.id)

                if (memberRecIds.length > 0) {
                    const { data: anyTags, error: anyTagsError } = await supabaseClient
                        .from('recommendation_teams')
                        .select('recommendation_id')
                        .in('recommendation_id', memberRecIds)
                        // A recommendation can carry several tag rows, so this set is
                        // larger than the one above. If it ever truncated, a tagged
                        // recommendation would be misread as untagged and shown on a
                        // team it was not assigned to -- wrong in the permissive
                        // direction, never the hiding one, but still wrong. The
                        // ceiling is far above one fund's volume; past it, move this
                        // whole block into a SQL function called through .rpc().
                        .limit(UNTAGGED_SCAN_LIMIT * 4)

                    if (anyTagsError) {
                        console.error('Error fetching tag coverage:', anyTagsError)
                        return new Response(
                            JSON.stringify({ error: 'Failed to fetch team recommendations', details: anyTagsError?.message }),
                            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                        )
                    }

                    const tagged = new Set((anyTags || []).map((r: any) => r.recommendation_id))
                    for (const id of memberRecIds) {
                        if (!tagged.has(id)) recIds.add(id)
                    }
                }
            }

            if (recIds.size === 0) {
                return new Response(
                    JSON.stringify({
                        success: true,
                        recommendations: []
                    }),
                    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            query = query.in('id', [...recIds])
        }

        // Execute query (RLS will enforce visibility rules)
        const { data: recommendations, error: recommendationsError } = await query

        if (recommendationsError) {
            console.error('Error fetching recommendations:', recommendationsError)
            return new Response(
                JSON.stringify({ error: 'Failed to fetch recommendations', details: recommendationsError?.message }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        return new Response(
            JSON.stringify({
                success: true,
                recommendations: recommendations || []
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


