// Edge Function: rebalance
// Purpose: Rebalance portfolio weights using proportional redistribution
// Formula: w_i' = w_i * (1 - newWeight) / (1 - oldWeight)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, origin',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

interface Weight {
  ticker: string;
  weight: number;
}

interface RebalanceRequest {
  currentWeights: Weight[];
  targetTicker: string;
  newWeight: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const { currentWeights, targetTicker, newWeight }: RebalanceRequest = await req.json()

    // Validate input
    if (!currentWeights || !targetTicker || newWeight === undefined) {
      return new Response(
        JSON.stringify({ error: 'currentWeights, targetTicker, and newWeight are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Find current weight of target ticker
    const targetWeight = currentWeights.find(w => w.ticker === targetTicker)
    if (!targetWeight) {
      return new Response(
        JSON.stringify({ error: `Ticker ${targetTicker} not found in current weights` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const oldWeight = targetWeight.weight
    
    // Edge case: if only one position, set to 100%
    if (currentWeights.length === 1) {
      return new Response(
        JSON.stringify({ 
          rebalancedWeights: [{ ticker: targetTicker, weight: 100.0 }] 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Calculate remaining weight before and after
    const remainingOld = 1.0 - (oldWeight / 100.0)
    const remainingNew = 1.0 - (newWeight / 100.0)

    // Edge case: avoid division by zero
    if (remainingOld <= 0.001) {
      // Distribute equally among all other positions
      const otherTickers = currentWeights.filter(w => w.ticker !== targetTicker)
      const equalWeight = (remainingNew * 100.0) / otherTickers.length
      
      const rebalancedWeights = [
        { ticker: targetTicker, weight: Math.round(newWeight * 100) / 100 },
        ...otherTickers.map(w => ({
          ticker: w.ticker,
          weight: Math.round(equalWeight * 100) / 100
        }))
      ]

      return new Response(
        JSON.stringify({ rebalancedWeights }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Proportional redistribution
    const rebalancedWeights = currentWeights.map(w => {
      if (w.ticker === targetTicker) {
        return {
          ticker: w.ticker,
          weight: Math.round(newWeight * 100) / 100
        }
      } else {
        // w_i' = w_i * (1 - newWeight) / (1 - oldWeight)
        const newWeightValue = (w.weight / 100.0) * (remainingNew / remainingOld) * 100.0
        return {
          ticker: w.ticker,
          weight: Math.round(newWeightValue * 100) / 100
        }
      }
    })

    // Ensure sum is exactly 100% by adjusting the last non-target ticker
    const totalWeight = rebalancedWeights.reduce((sum, w) => sum + w.weight, 0)
    const diff = 100.0 - totalWeight

    if (Math.abs(diff) > 0.01) {
      // Find last non-target ticker and adjust
      for (let i = rebalancedWeights.length - 1; i >= 0; i--) {
        if (rebalancedWeights[i].ticker !== targetTicker) {
          rebalancedWeights[i].weight = Math.round((rebalancedWeights[i].weight + diff) * 100) / 100
          break
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        rebalancedWeights,
        totalWeight: rebalancedWeights.reduce((sum, w) => sum + w.weight, 0)
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in rebalance:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

