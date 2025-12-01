// Edge Function: get-weights
// Purpose: Retrieve user portfolio weights from database

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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

    // Get userId from query params
    const url = new URL(req.url)
    const userId = url.searchParams.get('userId')

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId query parameter is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch weights from database
    const { data, error } = await supabaseClient
      .from('analyst_portfolio_weights')
      .select('ticker, weight_pct, updated_at')
      .eq('user_id', userId)
      .order('ticker', { ascending: true })

    if (error) {
      console.error('Error fetching weights:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch weights', details: error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Transform to expected format
    const weights = (data || []).map(w => ({
      ticker: w.ticker,
      weight: w.weight_pct
    }))

    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0)

    return new Response(
      JSON.stringify({ 
        weights,
        totalWeight,
        count: weights.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in get-weights:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

