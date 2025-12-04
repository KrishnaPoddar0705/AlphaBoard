// Edge Function: join-organization
// Purpose: Join an organization using a join code
// Updates all user data with organization_id
// Assigns user the 'analyst' role

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

    // Extract token from Authorization header (format: "Bearer <token>")
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

    // Verify user exists in auth.users using admin client
    const { data: authUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId)

    if (userError || !authUser?.user) {
      console.error('User verification error:', userError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: 'User not found or invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { userId: providedUserId, joinCode } = await req.json()

    // Validate input
    if (!joinCode || typeof joinCode !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Join code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Use provided userId or default to authenticated user
    const targetUserId = providedUserId || userId

    // Verify targetUserId matches authenticated user (security check)
    if (targetUserId !== userId) {
      return new Response(
        JSON.stringify({ error: 'Cannot join organization for another user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user already has an organization membership (using admin client)
    const { data: existingMembership, error: checkError } = await supabaseAdmin
      .from('user_organization_membership')
      .select('id, organization_id')
      .eq('user_id', targetUserId)
      .maybeSingle()

    if (checkError) {
      console.error('Error checking membership:', checkError)
      return new Response(
        JSON.stringify({ error: 'Failed to check existing membership', details: checkError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (existingMembership) {
      return new Response(
        JSON.stringify({ error: 'User already belongs to an organization' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Find organization by join code (using admin client)
    const { data: organization, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, name')
      .eq('join_code', joinCode.trim())
      .single()

    if (orgError || !organization) {
      return new Response(
        JSON.stringify({ error: 'Invalid join code' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create membership with 'analyst' role (using admin client)
    const { error: membershipError } = await supabaseAdmin
      .from('user_organization_membership')
      .insert({
        user_id: targetUserId,
        organization_id: organization.id,
        role: 'analyst', // Users joining via join code get analyst role
      })

    if (membershipError) {
      console.error('Error creating membership:', membershipError)
      return new Response(
        JSON.stringify({ error: 'Failed to join organization', details: membershipError.message, code: membershipError.code }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update ALL user data with organization_id (using admin client)
    const orgId = organization.id

    // Update profiles
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ organization_id: orgId })
      .eq('id', targetUserId)

    if (profileError) {
      console.warn('Warning: Could not update profiles:', profileError)
    }

    // Update recommendations
    const { error: recError } = await supabaseAdmin
      .from('recommendations')
      .update({ organization_id: orgId })
      .eq('user_id', targetUserId)
      .is('organization_id', null)

    if (recError) {
      console.warn('Warning: Could not update recommendations:', recError)
    }

    // Update analyst_portfolio_weights
    const { error: weightsError } = await supabaseAdmin
      .from('analyst_portfolio_weights')
      .update({ organization_id: orgId })
      .eq('user_id', targetUserId)
      .is('organization_id', null)

    if (weightsError) {
      console.warn('Warning: Could not update analyst_portfolio_weights:', weightsError)
    }

    // Update price_targets (if table exists)
    try {
      const { error: priceTargetsError } = await supabaseAdmin
        .from('price_targets')
        .update({ organization_id: orgId })
        .eq('user_id', targetUserId)
        .is('organization_id', null)

      if (priceTargetsError) {
        console.warn('Warning: Could not update price_targets:', priceTargetsError)
      }
    } catch (e) {
      // Table might not exist, ignore
      console.warn('Warning: price_targets table might not exist')
    }

    // Update podcasts (if table exists)
    try {
      const { error: podcastsError } = await supabaseAdmin
        .from('podcasts')
        .update({ organization_id: orgId })
        .eq('user_id', targetUserId)
        .is('organization_id', null)

      if (podcastsError) {
        console.warn('Warning: Could not update podcasts:', podcastsError)
      }
    } catch (e) {
      // Table might not exist, ignore
      console.warn('Warning: podcasts table might not exist')
    }

    console.log(`Successfully added user ${targetUserId} to organization ${organization.id} as analyst`)

    return new Response(
      JSON.stringify({
        success: true,
        organizationId: organization.id,
        organizationName: organization.name,
        role: 'analyst',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in join-organization:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
