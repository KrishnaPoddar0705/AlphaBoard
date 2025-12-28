// Edge Function: get-visible-recommendations
// Purpose: Get all recommendations visible to the current user (RLS-enforced)
// Returns recommendations based on team membership and admin status

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

        // If teamId is provided, filter by team members' recommendations
        if (teamId) {
            // Get all user IDs in the team
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

            if (teamMembers && teamMembers.length > 0) {
                const userIds = teamMembers.map((m: any) => m.user_id)
                query = query.in('user_id', userIds)
            } else {
                // No team members - return empty array
                return new Response(
                    JSON.stringify({
                        success: true,
                        recommendations: []
                    }),
                    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }
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


