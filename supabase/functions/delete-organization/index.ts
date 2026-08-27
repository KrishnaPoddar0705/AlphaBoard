// Edge Function: delete-organization
// Purpose: Permanently delete an organization (admin-only)
// Detaches every member, then deletes the linked Clerk organization.

// @ts-ignore - Deno runtime URL imports (Supabase Edge Functions run in Deno, not Node.js)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore - Deno runtime URL imports (Supabase Edge Functions run in Deno, not Node.js)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { clerkInstanceKind, deleteClerkOrganization } from '../_shared/clerk.ts'

// @ts-ignore - Deno is available at runtime but TypeScript doesn't recognize it
declare const Deno: any

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
}

function json(body: unknown, status: number) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders })
    }

    try {
        const { organizationId, clerkUserId } = await req.json().catch(() => ({}))

        if (!organizationId) {
            return json({ error: 'organizationId is required' }, 400)
        }

        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        if (!serviceRoleKey) {
            console.error('SUPABASE_SERVICE_ROLE_KEY not set')
            return json({ error: 'Server configuration error' }, 500)
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

        // Resolve the caller's Supabase user ID. The app authenticates with
        // Clerk, so the Clerk ID is the primary path; the JWT path covers
        // callers that do hold a Supabase session.
        let requesterId: string | null = null

        if (clerkUserId) {
            const { data: mapping, error: mappingError } = await supabaseAdmin
                .from('clerk_user_mapping')
                .select('supabase_user_id')
                .eq('clerk_user_id', clerkUserId)
                .maybeSingle()

            if (mappingError || !mapping?.supabase_user_id) {
                return json({ error: 'Could not resolve your account. Please sign in again.' }, 401)
            }
            requesterId = mapping.supabase_user_id
        } else {
            const authHeader = req.headers.get('Authorization')
            if (!authHeader) {
                return json({ error: 'Unauthorized' }, 401)
            }
            const supabaseClient = createClient(
                supabaseUrl,
                Deno.env.get('SUPABASE_ANON_KEY') ?? '',
                { global: { headers: { Authorization: authHeader } } },
            )
            const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
            if (authError || !user) {
                return json({ error: 'Unauthorized' }, 401)
            }
            requesterId = user.id
        }

        // Authorize: only an admin of THIS organization may delete it.
        const { data: membership, error: membershipError } = await supabaseAdmin
            .from('user_organization_membership')
            .select('role')
            .eq('user_id', requesterId)
            .eq('organization_id', organizationId)
            .maybeSingle()

        if (membershipError) {
            console.error('Error checking membership:', membershipError)
            return json({ error: 'Failed to verify permissions', details: membershipError.message }, 500)
        }

        if (!membership || membership.role !== 'admin') {
            return json({ error: 'Only organization admins can delete the organization' }, 403)
        }

        const { data: organization, error: orgError } = await supabaseAdmin
            .from('organizations')
            .select('id, name, clerk_org_id')
            .eq('id', organizationId)
            .maybeSingle()

        if (orgError || !organization) {
            return json({ error: 'Organization not found' }, 404)
        }

        // Collect members before the delete cascades them away, so the Clerk
        // cleanup and the response can report who was detached.
        const { data: members } = await supabaseAdmin
            .from('user_organization_membership')
            .select('user_id')
            .eq('organization_id', organizationId)

        const memberIds: string[] = (members ?? []).map((m: { user_id: string }) => m.user_id)

        // Detach org-scoped data explicitly rather than relying on the FK's
        // ON DELETE SET NULL. This project has profiles carrying an
        // organization_id for organizations that no longer exist, so that
        // cascade cannot be assumed to be in force here.
        //
        // Clear by organization_id rather than by member ID: a profile whose
        // membership row is already missing would otherwise be left orphaned.
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({ organization_id: null })
            .eq('organization_id', organizationId)
        if (profileError) {
            console.warn('Warning: could not clear profiles.organization_id:', profileError)
        }

        for (const table of ['recommendations', 'analyst_portfolio_weights', 'price_targets', 'podcasts']) {
            const { error: clearError } = await supabaseAdmin
                .from(table)
                .update({ organization_id: null })
                .eq('organization_id', organizationId)
            if (clearError) {
                console.warn(`Warning: could not clear organization_id on ${table}:`, clearError)
            }
        }

        // Delete the Clerk organization before the local row, so a Clerk failure
        // does not orphan a Clerk org whose link we have already thrown away.
        let clerkSyncError: string | null = null
        if (organization.clerk_org_id) {
            const clerkSecretKey = Deno.env.get('CLERK_SECRET_KEY')
            if (!clerkSecretKey) {
                clerkSyncError = 'CLERK_SECRET_KEY is not configured for this project'
                console.error(`Clerk delete skipped: ${clerkSyncError}`)
            } else {
                console.log(`Clerk sync using ${clerkInstanceKind(clerkSecretKey)} instance key`)
                const deleted = await deleteClerkOrganization(clerkSecretKey, organization.clerk_org_id)
                // A 404 means it is already gone (or lives in another instance);
                // either way there is nothing left to clean up.
                if (deleted.ok || deleted.status === 404) {
                    console.log(`Deleted Clerk organization ${organization.clerk_org_id}`)
                } else {
                    clerkSyncError = deleted.error ?? 'Unknown Clerk error'
                    console.error('Failed to delete Clerk organization:', clerkSyncError)
                }
            }
        }

        const { error: deleteError } = await supabaseAdmin
            .from('organizations')
            .delete()
            .eq('id', organizationId)

        if (deleteError) {
            console.error('Error deleting organization:', deleteError)
            return json({ error: 'Failed to delete organization', details: deleteError.message }, 500)
        }

        console.log(`Deleted organization ${organizationId} (${organization.name}), detached ${memberIds.length} member(s)`)

        return json({
            success: true,
            organizationId,
            organizationName: organization.name,
            membersDetached: memberIds.length,
            clerkSyncError,
        }, 200)

    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('Error in delete-organization:', error)
        return json({ error: message || 'Internal server error' }, 500)
    }
})
