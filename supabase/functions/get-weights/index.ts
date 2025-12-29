// Edge Function: get-weights
// Purpose: Retrieve user portfolio weights from database

// @ts-ignore - Deno runtime URL imports (Supabase Edge Functions run in Deno, not Node.js)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore - Deno runtime URL imports (Supabase Edge Functions run in Deno, not Node.js)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// Declare Deno global for TypeScript (Supabase Edge Functions run in Deno runtime)
// @ts-ignore - Deno is available at runtime but TypeScript doesn't recognize it
declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, origin',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
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

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()

    if (authError || !user || user.id !== userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: 'User verification failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

