// Edge Function: sync-clerk-user
// Purpose: Sync Clerk user authentication with Supabase user
// Creates or finds Supabase user for Clerk user and returns Supabase session token

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, origin, x-clerk-token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
}

interface ClerkUserInfo {
    clerkUserId: string
    email: string
    username?: string
    firstName?: string
    lastName?: string
}

interface SyncRequest {
    clerkUser: ClerkUserInfo
    clerkToken?: string // Optional Clerk JWT token for verification
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

        // Parse request body
        // Note: This function doesn't require authentication since it's called from frontend
        // before Supabase session exists. It uses service role for all operations.
        const { clerkUser, clerkToken }: SyncRequest = await req.json()

        // Validate input
        if (!clerkUser || !clerkUser.clerkUserId || !clerkUser.email) {
            return new Response(
                JSON.stringify({ error: 'clerkUser with clerkUserId and email is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const { clerkUserId, email, username, firstName, lastName } = clerkUser

        // Check if mapping already exists
        const { data: existingMapping, error: mappingError } = await supabaseAdmin
            .from('clerk_user_mapping')
            .select('supabase_user_id')
            .eq('clerk_user_id', clerkUserId)
            .maybeSingle()

        if (mappingError && mappingError.code !== 'PGRST116') { // PGRST116 = no rows returned
            console.error('Error checking mapping:', mappingError)
            return new Response(
                JSON.stringify({ error: 'Failed to check user mapping', details: mappingError.message }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        let supabaseUserId: string

        if (existingMapping) {
            // Mapping exists, use existing Supabase user ID
            supabaseUserId = existingMapping.supabase_user_id

            // Verify user still exists in auth.users
            const { data: authUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(supabaseUserId)

            if (userError || !authUser?.user) {
                // User was deleted, need to recreate
                console.log(`Supabase user ${supabaseUserId} not found, recreating...`)
                // Fall through to create new user
            } else {
                // User exists, update mapping timestamp
                await supabaseAdmin
                    .from('clerk_user_mapping')
                    .update({ updated_at: new Date().toISOString() })
                    .eq('clerk_user_id', clerkUserId)

                // Generate a session token directly using admin API
                // This creates an access token that can be used immediately
                const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
                    type: 'magiclink',
                    email: email,
                })

                if (sessionError || !sessionData) {
                    console.error('Error generating session link:', sessionError)
                    // Fallback: return user ID, frontend will handle session creation
                    return new Response(
                        JSON.stringify({
                            success: true,
                            supabaseUserId,
                            email,
                            isNewUser: false,
                            sessionToken: null,
                        }),
                        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    )
                }

                // Extract the token from the magic link
                // The action_link contains a token we can use
                const actionLink = sessionData.properties?.action_link || ''
                const tokenMatch = actionLink.match(/[#&]token=([^&]+)/)
                const sessionToken = tokenMatch ? tokenMatch[1] : sessionData.properties?.hashed_token || null

                return new Response(
                    JSON.stringify({
                        success: true,
                        supabaseUserId,
                        email,
                        isNewUser: false,
                        sessionToken: sessionToken,
                        magicLink: actionLink,
                    }),
                    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }
        }

        // IMPORTANT: Do NOT check for existing Supabase users by email
        // This causes multiple Clerk users to map to the same Supabase user
        // Each Clerk user should get their own Supabase user account
        // Migration should be handled separately via the migration script

        // If no mapping exists, always create a NEW Supabase user for this Clerk user
        // This ensures each Clerk account has its own isolated Supabase account

        // New user - create Supabase user
        // Note: Even if email matches an existing user, we create a new one if that user is already mapped
        // This ensures each Clerk user gets their own Supabase user account
        const userMetadata: Record<string, any> = {}
        if (username) userMetadata.username = username
        if (firstName) userMetadata.first_name = firstName
        if (lastName) userMetadata.last_name = lastName
        userMetadata.clerk_user_id = clerkUserId

        // For new users, use a unique email if the base email is already taken
        // Format: email+clerk_user_id@domain (e.g., user@example.com+user_123@example.com)
        // But Supabase doesn't support this, so we'll just create with the email
        // The important part is that each Clerk user gets their own Supabase user
        const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            email_confirm: true, // Auto-confirm email since Clerk already verified it
            user_metadata: userMetadata,
        })

        if (createUserError || !newUser.user) {
            console.error('Error creating Supabase user:', createUserError)
            return new Response(
                JSON.stringify({ error: 'Failed to create Supabase user', details: createUserError?.message }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        supabaseUserId = newUser.user.id

        // Create mapping
        const { error: mappingInsertError } = await supabaseAdmin
            .from('clerk_user_mapping')
            .insert({
                clerk_user_id: clerkUserId,
                supabase_user_id: supabaseUserId,
                email: email,
            })

        if (mappingInsertError) {
            console.error('Error creating mapping:', mappingInsertError)
            // Non-fatal, continue
        }

        // Create profile (trigger should handle this, but ensure it exists)
        const { data: profileCheck } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('id', supabaseUserId)
            .maybeSingle()

        if (!profileCheck) {
            const { error: profileInsertError } = await supabaseAdmin
                .from('profiles')
                .insert({
                    id: supabaseUserId,
                    username: username || firstName || email.split('@')[0],
                    role: 'analyst',
                })

            if (profileInsertError) {
                console.error('Error creating profile:', profileInsertError)
                // Non-fatal, continue
            }

            // Create performance record
            await supabaseAdmin
                .from('performance')
                .insert({
                    user_id: supabaseUserId,
                })
                .catch(err => console.error('Error creating performance record:', err))
        }

        console.log(`Successfully synced Clerk user ${clerkUserId} to Supabase user ${supabaseUserId}`)

        // Generate a session token directly using admin API
        // This creates an access token that can be used immediately
        const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email: email,
        })

        if (sessionError || !sessionData) {
            console.error('Error generating session link:', sessionError)
            // Fallback: return user ID, frontend will handle session creation
            return new Response(
                JSON.stringify({
                    success: true,
                    supabaseUserId,
                    email,
                    isNewUser: true,
                    sessionToken: null,
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Extract the token from the magic link
        // The action_link contains a token we can use
        const actionLink = sessionData.properties?.action_link || ''
        const tokenMatch = actionLink.match(/[#&]token=([^&]+)/)
        const sessionToken = tokenMatch ? tokenMatch[1] : sessionData.properties?.hashed_token || null

        return new Response(
            JSON.stringify({
                success: true,
                supabaseUserId,
                email,
                isNewUser: true,
                sessionToken: sessionToken,
                magicLink: actionLink,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Error in sync-clerk-user:', error)
        return new Response(
            JSON.stringify({ error: error.message || 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})

