// Edge Function: remove-analyst
// Purpose: Remove an analyst from an organization (admin-only)
// Clears organization_id from all analyst data

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

    // Parse request body
    const { organizationId, analystUserId } = await req.json()

    // Validate input
    if (!organizationId || !analystUserId) {
      return new Response(
        JSON.stringify({ error: 'organizationId and analystUserId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify requester is admin of the organization
    const { data: membership, error: membershipError } = await supabaseClient
      .from('user_organization_membership')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .single()

    if (membershipError || !membership || membership.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Only organization admins can remove analysts' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify analyst belongs to this organization
    const { data: analystMembership, error: analystError } = await supabaseClient
      .from('user_organization_membership')
      .select('role')
      .eq('user_id', analystUserId)
      .eq('organization_id', organizationId)
      .single()

    if (analystError || !analystMembership) {
      return new Response(
        JSON.stringify({ error: 'Analyst does not belong to this organization' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prevent removing admins (or handle separately)
    if (analystMembership.role === 'admin') {
      return new Response(
        JSON.stringify({ error: 'Cannot remove admin users. Transfer admin role first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Remove membership
    const { error: deleteError } = await supabaseClient
      .from('user_organization_membership')
      .delete()
      .eq('user_id', analystUserId)
      .eq('organization_id', organizationId)

    if (deleteError) {
      console.error('Error removing membership:', deleteError)
      return new Response(
        JSON.stringify({ error: 'Failed to remove membership', details: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Clear organization_id from all analyst data
    // Update profiles
    await supabaseClient
      .from('profiles')
      .update({ organization_id: null })
      .eq('id', analystUserId)

    // Update recommendations
    await supabaseClient
      .from('recommendations')
      .update({ organization_id: null })
      .eq('user_id', analystUserId)
      .eq('organization_id', organizationId)

    // Update analyst_portfolio_weights
    await supabaseClient
      .from('analyst_portfolio_weights')
      .update({ organization_id: null })
      .eq('user_id', analystUserId)
      .eq('organization_id', organizationId)

    // Update price_targets (if table exists)
    try {
      await supabaseClient
        .from('price_targets')
        .update({ organization_id: null })
        .eq('user_id', analystUserId)
        .eq('organization_id', organizationId)
    } catch (e) {
      // Table might not exist, ignore
      console.warn('Warning: price_targets table might not exist')
    }

    // Update podcasts (if table exists)
    try {
      await supabaseClient
        .from('podcasts')
        .update({ organization_id: null })
        .eq('user_id', analystUserId)
        .eq('organization_id', organizationId)
    } catch (e) {
      // Table might not exist, ignore
      console.warn('Warning: podcasts table might not exist')
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Analyst removed from organization successfully',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in remove-analyst:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

