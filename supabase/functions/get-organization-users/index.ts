// Edge Function: get-organization-users
// Purpose: Get all users in an organization (admin-only)
// Returns analysts and admins separately

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
    // Create Supabase client with user's auth token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
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
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get organizationId from query params
    const url = new URL(req.url)
    const organizationId = url.searchParams.get('organizationId')

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: 'organizationId query parameter is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify user is admin of this organization
    const { data: membership, error: membershipError } = await supabaseClient
      .from('user_organization_membership')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .single()

    if (membershipError || !membership || membership.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Only organization admins can view members' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get all memberships for this organization
    const { data: memberships, error: membersError } = await supabaseClient
      .from('user_organization_membership')
      .select(`
        user_id,
        role,
        joined_at,
        profiles:user_id (
          username,
          id
        )
      `)
      .eq('organization_id', organizationId)
      .order('joined_at', { ascending: false })

    if (membersError) {
      console.error('Error fetching members:', membersError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch organization members', details: membersError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user emails from auth.users (requires service role or admin access)
    // For now, we'll use profiles data and note that email requires admin access
    const analysts: any[] = []
    const admins: any[] = []

    for (const membership of memberships || []) {
      const profile = membership.profiles as any
      const userData = {
        userId: membership.user_id,
        username: profile?.username || null,
        email: null, // Email requires admin access to auth.users
        role: membership.role,
        joinedAt: membership.joined_at,
      }

      if (membership.role === 'admin') {
        admins.push(userData)
      } else {
        analysts.push(userData)
      }
    }

    return new Response(
      JSON.stringify({
        analysts,
        admins,
        totalMembers: (memberships || []).length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in get-organization-users:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

