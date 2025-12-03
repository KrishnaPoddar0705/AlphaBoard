// Edge Function: create-organization
// Purpose: Create a new organization with secure join code
// Admin: Creates organization and assigns creator as admin

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Generate secure join code: 10-12 characters with alphanumeric + special chars
function generateJoinCode(): string {
    const length = Math.floor(Math.random() * 3) + 10; // 10-12 characters
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*';
    const allChars = uppercase + lowercase + numbers + special;

    // Ensure at least one of each type
    let code = '';
    code += uppercase[Math.floor(Math.random() * uppercase.length)];
    code += lowercase[Math.floor(Math.random() * lowercase.length)];
    code += numbers[Math.floor(Math.random() * numbers.length)];
    code += special[Math.floor(Math.random() * special.length)];

    // Fill the rest randomly
    for (let i = code.length; i < length; i++) {
        code += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the characters
    return code.split('').sort(() => Math.random() - 0.5).join('');
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
        // Get authorization header
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Missing Authorization header' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Extract token from Authorization header (format: "Bearer <token>")
        const token = authHeader.replace('Bearer ', '').trim()
        if (!token) {
            return new Response(
                JSON.stringify({ error: 'Invalid Authorization header format' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
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

        // Decode JWT token to get user ID (simple base64 decode of payload)
        // JWT format: header.payload.signature
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

        // Verify user exists in auth.users using admin client
        const { data: authUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId)

        if (userError || !authUser?.user) {
            console.error('User verification error:', userError)
            return new Response(
                JSON.stringify({ error: 'Unauthorized', details: 'User not found or invalid token' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const user = authUser.user

        // Parse request body
        const { name, adminUserId } = await req.json()

        // Validate input
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return new Response(
                JSON.stringify({ error: 'Organization name is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Use provided adminUserId or default to authenticated user
        const adminId = adminUserId || userId

        // Verify adminId matches authenticated user (security check)
        if (adminId !== userId) {
            return new Response(
                JSON.stringify({ error: 'Cannot create organization for another user' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // supabaseAdmin is already created above for token verification

        // Check if user already has an organization membership
        const { data: existingMembership, error: checkError } = await supabaseAdmin
            .from('user_organization_membership')
            .select('id')
            .eq('user_id', adminId)
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

        // Generate unique join code
        let joinCode: string
        let attempts = 0
        const maxAttempts = 10

        do {
            joinCode = generateJoinCode()
            const { data: existing } = await supabaseAdmin
                .from('organizations')
                .select('id')
                .eq('join_code', joinCode)
                .maybeSingle()

            if (!existing) break
            attempts++
        } while (attempts < maxAttempts)

        if (attempts >= maxAttempts) {
            return new Response(
                JSON.stringify({ error: 'Failed to generate unique join code. Please try again.' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Create organization (using service role - bypasses RLS)
        const { data: organization, error: orgError } = await supabaseAdmin
            .from('organizations')
            .insert({
                name: name.trim(),
                join_code: joinCode,
                created_by: adminId,
            })
            .select()
            .single()

        if (orgError) {
            console.error('Error creating organization:', orgError)
            return new Response(
                JSON.stringify({ error: 'Failed to create organization', details: orgError.message, code: orgError.code }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Create membership for admin (using service role - bypasses RLS)
        const { error: membershipError } = await supabaseAdmin
            .from('user_organization_membership')
            .insert({
                user_id: adminId,
                organization_id: organization.id,
                role: 'admin',
            })

        if (membershipError) {
            console.error('Error creating membership:', membershipError)
            // Rollback: delete organization
            await supabaseAdmin.from('organizations').delete().eq('id', organization.id)
            return new Response(
                JSON.stringify({ error: 'Failed to create membership', details: membershipError.message, code: membershipError.code }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Update user's profile with organization_id (using service role)
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({ organization_id: organization.id })
            .eq('id', adminId)

        if (profileError) {
            console.error('Error updating profile (non-critical):', profileError)
            // Non-critical, continue - membership was created successfully
        }

        console.log(`Successfully created organization ${organization.id} for user ${adminId}`)

        return new Response(
            JSON.stringify({
                organizationId: organization.id,
                joinCode: joinCode,
                name: organization.name,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Error in create-organization:', error)
        return new Response(
            JSON.stringify({ error: error.message || 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
