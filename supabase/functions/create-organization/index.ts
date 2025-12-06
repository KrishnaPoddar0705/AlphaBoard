// Edge Function: create-organization
// Purpose: Create a new organization with secure join code
// Admin: Creates organization and assigns creator as admin

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
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
        // Parse request body first to check for Clerk user ID
        const requestBody = await req.json().catch(() => ({}))
        const { name, adminUserId, clerkUserId } = requestBody

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
                // No mapping found - call sync-clerk-user function internally
                console.log(`No mapping found for Clerk user ${clerkUserId}, calling sync function...`)
                
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
                    const { error: mappingInsertError } = await supabaseAdmin
                        .from('clerk_user_mapping')
                        .insert({
                            clerk_user_id: clerkUserId,
                            supabase_user_id: finalUserId,
                            email: email,
                        })
                    
                    if (mappingInsertError) {
                        console.error('Failed to create mapping:', mappingInsertError)
                        // Continue anyway - user was created
                    }
                    
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

        const user = authUser.user

        // Validate input
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return new Response(
                JSON.stringify({ error: 'Organization name is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Use provided adminUserId or default to authenticated user
        const adminId = adminUserId || finalUserId

        // Verify adminId matches authenticated user (security check)
        if (adminId !== finalUserId) {
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

        // Create organization in Clerk if Clerk user ID is provided
        let clerkOrgId: string | null = null
        if (clerkUserId) {
            try {
                const clerkSecretKey = Deno.env.get('CLERK_SECRET_KEY')
                if (clerkSecretKey) {
                    const clerkApiUrl = 'https://api.clerk.com/v1'
                    const createOrgResponse = await fetch(`${clerkApiUrl}/organizations`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${clerkSecretKey}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            name: name.trim(),
                            created_by: clerkUserId,
                        }),
                    })

                    if (createOrgResponse.ok) {
                        const clerkOrg = await createOrgResponse.json()
                        clerkOrgId = clerkOrg.id
                        console.log(`Created Clerk organization ${clerkOrgId} for Supabase org ${organization.id}`)
                        
                        // Store Clerk org ID in Supabase (add to organizations table if column exists)
                        await supabaseAdmin
                            .from('organizations')
                            .update({ clerk_org_id: clerkOrgId })
                            .eq('id', organization.id)
                            .catch(err => console.warn('Could not update clerk_org_id:', err))
                    } else {
                        const error = await createOrgResponse.json().catch(() => ({}))
                        console.warn('Failed to create Clerk organization:', error)
                    }
                }
            } catch (error) {
                console.warn('Error creating Clerk organization:', error)
                // Non-critical, continue with Supabase organization
            }
        }

        return new Response(
            JSON.stringify({
                organizationId: organization.id,
                joinCode: joinCode,
                name: organization.name,
                clerkOrgId: clerkOrgId,
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
