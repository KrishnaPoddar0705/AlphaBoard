// Edge Function: get-organization-performance
// Purpose: Get aggregated performance metrics for all analysts in an organization (admin-only)
// Calls portfolio-returns edge function per analyst

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

const PORTFOLIO_RETURNS_URL = Deno.env.get('SUPABASE_URL') + '/functions/v1/portfolio-returns'

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
        JSON.stringify({ error: 'Only organization admins can view performance' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get all analysts in the organization
    const { data: memberships, error: membersError } = await supabaseClient
      .from('user_organization_membership')
      .select(`
        user_id,
        role,
        profiles:user_id (
          username,
          id
        )
      `)
      .eq('organization_id', organizationId)
      .eq('role', 'analyst')

    if (membersError) {
      console.error('Error fetching analysts:', membersError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch analysts', details: membersError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get additional stats for each analyst
    const analysts: any[] = []

    for (const membership of memberships || []) {
      const profile = membership.profiles as any
      const analystUserId = membership.user_id

      // Get recommendation counts
      const { data: recommendations } = await supabaseClient
        .from('recommendations')
        .select('id, status')
        .eq('user_id', analystUserId)

      const totalRecommendations = recommendations?.length || 0
      const openPositions = recommendations?.filter(r => r.status === 'OPEN').length || 0
      const closedPositions = recommendations?.filter(r => r.status === 'CLOSED').length || 0

      // Calculate win rate
      const { data: closedRecs } = await supabaseClient
        .from('recommendations')
        .select('final_return_pct')
        .eq('user_id', analystUserId)
        .eq('status', 'CLOSED')
        .not('final_return_pct', 'is', null)

      const profitableTrades = closedRecs?.filter(r => (r.final_return_pct || 0) > 0).length || 0
      const winRate = closedRecs && closedRecs.length > 0
        ? (profitableTrades / closedRecs.length) * 100
        : 0

      // Call portfolio-returns edge function for this analyst
      let performanceData: any = {
        returns: { '1M': 0, '3M': 0, '6M': 0, '12M': 0 },
        sharpe: 0,
        volatility: 0,
        drawdown: 0,
      }

      try {
        const portfolioReturnsResponse = await fetch(PORTFOLIO_RETURNS_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': req.headers.get('Authorization') || '',
            'apikey': Deno.env.get('SUPABASE_ANON_KEY') || '',
          },
          body: JSON.stringify({
            userId: analystUserId,
            period: '12M',
          }),
        })

        if (portfolioReturnsResponse.ok) {
          const portfolioData = await portfolioReturnsResponse.json()
          if (portfolioData.returns) {
            performanceData.returns = {
              '1M': portfolioData.returns['1M'] || 0,
              '3M': portfolioData.returns['3M'] || 0,
              '6M': portfolioData.returns['6M'] || 0,
              '12M': portfolioData.returns['12M'] || 0,
            }
            performanceData.sharpe = portfolioData.sharpe || 0
            performanceData.volatility = portfolioData.volatility || 0
            performanceData.drawdown = portfolioData.maxDrawdown || 0
          }
        }
      } catch (error) {
        console.warn(`Failed to fetch performance for analyst ${analystUserId}:`, error)
        // Continue with default values
      }

      analysts.push({
        userId: analystUserId,
        username: profile?.username || null,
        returns: performanceData.returns,
        sharpe: performanceData.sharpe,
        volatility: performanceData.volatility,
        drawdown: performanceData.drawdown,
        totalRecommendations,
        openPositions,
        closedPositions,
        winRate: Math.round(winRate * 100) / 100, // Round to 2 decimal places
      })
    }

    // Sort by 12M returns (descending)
    analysts.sort((a, b) => (b.returns['12M'] || 0) - (a.returns['12M'] || 0))

    return new Response(
      JSON.stringify({
        analysts,
        totalAnalysts: analysts.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in get-organization-performance:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

