// Edge Function: save-weights
// Purpose: Save user portfolio weights to database
// Validates that weights sum to ~100%

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, origin',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

interface WeightInput {
  ticker: string;
  weight: number;
}

interface SaveWeightsRequest {
  userId: string;
  weights: WeightInput[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Parse request body
    const { userId, weights }: SaveWeightsRequest = await req.json()

    // Validate input
    if (!userId || !weights || !Array.isArray(weights)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request. userId and weights array required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate weights sum to approximately 100%
    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0)
    if (Math.abs(totalWeight - 100) > 0.1) {
      return new Response(
        JSON.stringify({ 
          error: 'Weights must sum to 100%', 
          totalWeight,
          weights 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate each weight is between 0 and 100
    for (const w of weights) {
      if (w.weight < 0 || w.weight > 100) {
        return new Response(
          JSON.stringify({ error: `Invalid weight for ${w.ticker}: ${w.weight}. Must be between 0 and 100.` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Delete existing weights for this user
    const { error: deleteError } = await supabaseClient
      .from('analyst_portfolio_weights')
      .delete()
      .eq('user_id', userId)

    if (deleteError) {
      console.error('Error deleting old weights:', deleteError)
      return new Response(
        JSON.stringify({ error: 'Failed to delete old weights', details: deleteError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user's organization_id
    let organizationId: string | null = null
    try {
      const { data: membership } = await supabaseClient
        .from('user_organization_membership')
        .select('organization_id')
        .eq('user_id', userId)
        .single()
      
      if (membership) {
        organizationId = membership.organization_id
      }
    } catch (e) {
      // User might not be in an organization, continue with null
    }

    // Insert new weights
    const weightsToInsert = weights.map(w => ({
      user_id: userId,
      ticker: w.ticker,
      weight_pct: w.weight,
      organization_id: organizationId
    }))

    const { data, error: insertError } = await supabaseClient
      .from('analyst_portfolio_weights')
      .insert(weightsToInsert)
      .select()

    if (insertError) {
      console.error('Error inserting weights:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to save weights', details: insertError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Successfully saved ${weights.length} weights for user ${userId}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        weightsCount: weights.length,
        totalWeight,
        data 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in save-weights:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

