// Edge Function: update-member-role
// Purpose: Update a member's role in an organization (promote to admin or demote to analyst)
// Only organization admins can change roles

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

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

        // Verify user exists
        const { data: authUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId)
        if (userError || !authUser?.user) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized', details: userError?.message }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Parse request body
        const { orgId, targetUserId, newRole } = await req.json()

        // Validate input
        if (!orgId || !targetUserId || !newRole) {
            return new Response(
                JSON.stringify({ error: 'orgId, targetUserId, and newRole are required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (newRole !== 'admin' && newRole !== 'analyst') {
            return new Response(
                JSON.stringify({ error: 'newRole must be either "admin" or "analyst"' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Prevent self-demotion (user cannot demote themselves)
        if (userId === targetUserId && newRole === 'analyst') {
            return new Response(
                JSON.stringify({ error: 'You cannot demote yourself from admin role' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Verify requester is admin of the organization
        const { data: requesterMembership, error: requesterError } = await supabaseAdmin
            .from('user_organization_membership')
            .select('role')
            .eq('user_id', userId)
            .eq('organization_id', orgId)
            .maybeSingle()

        if (requesterError || !requesterMembership) {
            return new Response(
                JSON.stringify({ error: 'You are not a member of this organization' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (requesterMembership.role !== 'admin') {
            return new Response(
                JSON.stringify({ error: 'Only organization admins can change member roles' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Verify target user is a member of the organization
        const { data: targetMembership, error: targetError } = await supabaseAdmin
            .from('user_organization_membership')
            .select('role')
            .eq('user_id', targetUserId)
            .eq('organization_id', orgId)
            .maybeSingle()

        if (targetError || !targetMembership) {
            return new Response(
                JSON.stringify({ error: 'Target user is not a member of this organization' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Check if role is already the desired role
        if (targetMembership.role === newRole) {
            return new Response(
                JSON.stringify({ 
                    success: true, 
                    message: `User is already ${newRole}`,
                    role: newRole 
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Update the role
        const { data: updatedMembership, error: updateError } = await supabaseAdmin
            .from('user_organization_membership')
            .update({ role: newRole })
            .eq('user_id', targetUserId)
            .eq('organization_id', orgId)
            .select()
            .single()

        if (updateError || !updatedMembership) {
            console.error('Error updating role:', updateError)
            return new Response(
                JSON.stringify({ error: 'Failed to update member role', details: updateError?.message }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: `Successfully ${newRole === 'admin' ? 'promoted' : 'demoted'} member to ${newRole}`,
                role: newRole,
                membership: updatedMembership
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Unexpected error:', error)
        return new Response(
            JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})


