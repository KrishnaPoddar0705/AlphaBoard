// Edge Function: clerk-webhook
// Purpose: Handle Clerk webhooks to automatically sync users to Supabase
// Events: user.created, user.updated

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
}

interface ClerkWebhookEvent {
    object: string
    type: string
    data: {
        id: string
        email_addresses: Array<{
            id: string
            email_address: string
            verification: {
                status: string
            }
        }>
        username: string | null
        first_name: string | null
        last_name: string | null
        created_at: number
        updated_at: number
    }
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

        // Parse webhook payload
        const webhookEvent: ClerkWebhookEvent = await req.json()

        // Verify webhook event type
        if (webhookEvent.object !== 'event') {
            return new Response(
                JSON.stringify({ error: 'Invalid webhook event' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Handle user.created event
        if (webhookEvent.type === 'user.created') {
            const userData = webhookEvent.data
            const clerkUserId = userData.id

            // Get primary email
            const primaryEmail = userData.email_addresses.find(e => e.verification.status === 'verified') 
                || userData.email_addresses[0]

            if (!primaryEmail) {
                console.warn(`User ${clerkUserId} has no email address, skipping sync`)
                return new Response(
                    JSON.stringify({ success: true, message: 'User has no email, skipped' }),
                    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            const email = primaryEmail.email_address

            console.log(`🔄 Syncing new Clerk user: ${email} (${clerkUserId})`)

            // Check if mapping already exists
            const { data: existingMapping } = await supabaseAdmin
                .from('clerk_user_mapping')
                .select('supabase_user_id')
                .eq('clerk_user_id', clerkUserId)
                .maybeSingle()

            if (existingMapping) {
                console.log(`User ${clerkUserId} already mapped to ${existingMapping.supabase_user_id}`)
                return new Response(
                    JSON.stringify({ 
                        success: true, 
                        message: 'User already mapped',
                        supabaseUserId: existingMapping.supabase_user_id 
                    }),
                    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            // Create Supabase user
            const userMetadata: Record<string, any> = {}
            if (userData.username) userMetadata.username = userData.username
            if (userData.first_name) userMetadata.first_name = userData.first_name
            if (userData.last_name) userMetadata.last_name = userData.last_name
            userMetadata.clerk_user_id = clerkUserId
            userMetadata.created_via_webhook = true
            userMetadata.webhook_created_at = new Date().toISOString()

            const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
                email: email,
                email_confirm: true, // Auto-confirm since Clerk already verified
                user_metadata: userMetadata,
            })

            if (createUserError || !newUser.user) {
                console.error('Error creating Supabase user:', createUserError)
                return new Response(
                    JSON.stringify({ error: 'Failed to create Supabase user', details: createUserError?.message }),
                    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            const supabaseUserId = newUser.user.id

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

            // Create profile
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
                        username: userData.username || userData.first_name || email.split('@')[0],
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

            console.log(`✅ Successfully synced Clerk user ${clerkUserId} to Supabase user ${supabaseUserId}`)

            return new Response(
                JSON.stringify({
                    success: true,
                    message: 'User synced successfully',
                    supabaseUserId,
                    email,
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Handle user.updated event (optional - update metadata if needed)
        if (webhookEvent.type === 'user.updated') {
            const userData = webhookEvent.data
            const clerkUserId = userData.id

            // Find existing mapping
            const { data: mapping } = await supabaseAdmin
                .from('clerk_user_mapping')
                .select('supabase_user_id')
                .eq('clerk_user_id', clerkUserId)
                .maybeSingle()

            if (mapping) {
                // Update user metadata in Supabase
                const userMetadata: Record<string, any> = {}
                if (userData.username) userMetadata.username = userData.username
                if (userData.first_name) userMetadata.first_name = userData.first_name
                if (userData.last_name) userMetadata.last_name = userData.last_name
                userMetadata.clerk_user_id = clerkUserId

                await supabaseAdmin.auth.admin.updateUserById(mapping.supabase_user_id, {
                    user_metadata: userMetadata,
                }).catch(err => console.warn('Error updating user metadata:', err))

                console.log(`✅ Updated Supabase user ${mapping.supabase_user_id} for Clerk user ${clerkUserId}`)
            }

            return new Response(
                JSON.stringify({ success: true, message: 'User updated' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Unknown event type - return success but don't process
        console.log(`Unknown webhook event type: ${webhookEvent.type}`)
        return new Response(
            JSON.stringify({ success: true, message: 'Event type not handled' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Error processing webhook:', error)
        return new Response(
            JSON.stringify({ error: error.message || 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})

