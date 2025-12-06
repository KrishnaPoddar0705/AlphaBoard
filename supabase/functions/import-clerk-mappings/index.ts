// Edge Function: import-clerk-mappings
// Purpose: Import Clerk user mappings from migration JSON file
// This helps create mappings after migrating users from Supabase to Clerk

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface Mapping {
  supabaseUserId: string
  clerkUserId: string
  email: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey,
    )

    // Parse mappings from request body
    const { mappings }: { mappings: Mapping[] } = await req.json()

    if (!mappings || !Array.isArray(mappings)) {
      return new Response(
        JSON.stringify({ error: 'mappings array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    }

    // Insert mappings one by one
    for (const mapping of mappings) {
      try {
        const { error } = await supabaseAdmin
          .from('clerk_user_mapping')
          .insert({
            clerk_user_id: mapping.clerkUserId,
            supabase_user_id: mapping.supabaseUserId,
            email: mapping.email,
          })
          .select()
          .single()

        if (error) {
          // Try update if insert fails (duplicate)
          const { error: updateError } = await supabaseAdmin
            .from('clerk_user_mapping')
            .update({
              supabase_user_id: mapping.supabaseUserId,
              email: mapping.email,
              updated_at: new Date().toISOString(),
            })
            .eq('clerk_user_id', mapping.clerkUserId)

          if (updateError) {
            results.failed++
            results.errors.push(`${mapping.email}: ${updateError.message}`)
            continue
          }
        }

        results.success++
      } catch (err: any) {
        results.failed++
        results.errors.push(`${mapping.email}: ${err.message}`)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        imported: results.success,
        failed: results.failed,
        errors: results.errors,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

