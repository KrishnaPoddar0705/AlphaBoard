// Edge Function: join-organization
// Purpose: Join an organization using a join code
// Updates all user data with organization_id
// Assigns user the 'analyst' role

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
    // Parse request body first to check for Clerk user ID
    const requestBody = await req.json().catch(() => ({}))
    const { userId: providedUserId, joinCode, clerkUserId } = requestBody

    // Get authorization header (only used if Clerk user ID is NOT provided)
    const authHeader = req.headers.get('Authorization')
    let token: string | null = null

    // Only parse token if we don't have Clerk user ID
    // This prevents "Invalid token format" errors when anon key is sent
    if (!clerkUserId && authHeader) {
      const bearerToken = authHeader.replace('Bearer ', '').trim()
      // Only use token if it looks like a JWT (has 3 parts separated by dots)
      if (bearerToken.split('.').length === 3) {
        token = bearerToken
      }
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

    // Request body already parsed above

    // If we have a Clerk user ID, use it to look up Supabase user ID
    let finalUserId: string | null = null
    if (clerkUserId) {
      console.log(`Looking up Supabase user for Clerk user: ${clerkUserId}`)
      const { data: mapping, error: mappingError } = await supabaseAdmin
        .from('clerk_user_mapping')
        .select('supabase_user_id')
        .eq('clerk_user_id', clerkUserId)
        .maybeSingle()

      if (!mappingError && mapping?.supabase_user_id) {
        finalUserId = mapping.supabase_user_id
        console.log(`Found Supabase user ID: ${finalUserId} for Clerk user: ${clerkUserId}`)
      } else {
        // No mapping found - try to auto-sync by fetching Clerk user info
        console.log(`No mapping found for Clerk user ${clerkUserId}, attempting auto-sync...`)

        try {
          const clerkSecretKey = Deno.env.get('CLERK_SECRET_KEY')
          if (!clerkSecretKey) {
            return new Response(
              JSON.stringify({
                error: 'Server configuration error',
                details: 'CLERK_SECRET_KEY not configured. Please contact support.'
              }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }

          // Fetch Clerk user info to get email
          const clerkApiUrl = 'https://api.clerk.com/v1'
          const clerkUserResponse = await fetch(`${clerkApiUrl}/users/${clerkUserId}`, {
            headers: {
              'Authorization': `Bearer ${clerkSecretKey}`,
            },
          })

          if (!clerkUserResponse.ok) {
            const errorText = await clerkUserResponse.text()
            console.error('Failed to fetch Clerk user:', errorText)
            return new Response(
              JSON.stringify({
                error: 'Failed to fetch user from Clerk',
                details: `Clerk API error: ${clerkUserResponse.status}`
              }),
              { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }

          const clerkUser = await clerkUserResponse.json()
          const email = clerkUser.email_addresses?.[0]?.email_address

          if (!email) {
            return new Response(
              JSON.stringify({
                error: 'Invalid Clerk user',
                details: 'Clerk user has no email address'
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }

          // Create Supabase user directly (same logic as sync-clerk-user)
          const userMetadata: Record<string, any> = {}
          if (clerkUser.username) userMetadata.username = clerkUser.username
          if (clerkUser.first_name) userMetadata.first_name = clerkUser.first_name
          if (clerkUser.last_name) userMetadata.last_name = clerkUser.last_name
          userMetadata.clerk_user_id = clerkUserId

          const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            email_confirm: true,
            user_metadata: userMetadata,
          })

          if (createUserError || !newUser?.user) {
            console.error('Failed to create Supabase user:', createUserError)
            return new Response(
              JSON.stringify({
                error: 'Failed to create user',
                details: createUserError?.message || 'Unknown error'
              }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }

          finalUserId = newUser.user.id
          console.log(`Created Supabase user ${finalUserId}`)

          // Create mapping
          await supabaseAdmin
            .from('clerk_user_mapping')
            .insert({
              clerk_user_id: clerkUserId,
              supabase_user_id: finalUserId,
              email: email,
            })
            .catch(err => console.warn('Failed to create mapping:', err))

          // Create profile
          await supabaseAdmin
            .from('profiles')
            .insert({
              id: finalUserId,
              username: clerkUser.username || clerkUser.first_name || email.split('@')[0],
              role: 'analyst',
            })
            .catch(err => console.warn('Failed to create profile:', err))

          // Create performance record
          await supabaseAdmin
            .from('performance')
            .insert({ user_id: finalUserId })
            .catch(err => console.warn('Failed to create performance record:', err))

          console.log(`Auto-synced Clerk user ${clerkUserId} to Supabase user ${finalUserId}`)
        } catch (syncError) {
          console.error('Error during auto-sync:', syncError)
          return new Response(
            JSON.stringify({
              error: 'Sync failed',
              details: syncError instanceof Error ? syncError.message : String(syncError)
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
    } else if (token) {
      // Fallback to JWT token if no Clerk user ID provided
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
          JSON.stringify({ error: 'Invalid token format or missing Clerk user ID' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      finalUserId = userId
    } else {
      return new Response(
        JSON.stringify({ error: 'Missing authentication: provide either Clerk user ID or Authorization token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify user exists in auth.users using admin client
    const { data: authUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(finalUserId)

    if (userError || !authUser?.user) {
      console.error('User verification error:', userError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: 'User not found or invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate input
    if (!joinCode || typeof joinCode !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Join code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Use provided userId or default to authenticated user
    const targetUserId = providedUserId || finalUserId

    // Verify targetUserId matches authenticated user (security check)
    if (targetUserId !== finalUserId) {
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
      .select('id, name, clerk_org_id')
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

    // Add user to Clerk organization if Clerk user ID and Clerk org ID are available
    if (clerkUserId && organization.clerk_org_id) {
      try {
        const clerkSecretKey = Deno.env.get('CLERK_SECRET_KEY')
        if (clerkSecretKey) {
          const clerkApiUrl = 'https://api.clerk.com/v1'
          const addMemberResponse = await fetch(
            `${clerkApiUrl}/organizations/${organization.clerk_org_id}/memberships`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${clerkSecretKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                userId: clerkUserId,
                role: 'org:member', // Clerk role for regular members
              }),
            }
          )

          if (addMemberResponse.ok) {
            console.log(`Added Clerk user ${clerkUserId} to Clerk organization ${organization.clerk_org_id}`)
          } else {
            const error = await addMemberResponse.json().catch(() => ({}))
            console.warn('Failed to add user to Clerk organization:', error)
            // Non-critical, continue with Supabase membership
          }
        }
      } catch (error) {
        console.warn('Error adding user to Clerk organization:', error)
        // Non-critical, continue with Supabase membership
      }
    }

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
