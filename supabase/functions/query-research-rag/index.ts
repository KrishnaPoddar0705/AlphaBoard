// Edge Function: query-research-rag
// Purpose: Query research reports using RAG with citations

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { queryGeminiRAG } from '../_shared/gemini-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, origin',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract token from Authorization header
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Invalid Authorization header format' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get service role key for database operations
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceRoleKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY not set');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey,
    );

    // Decode JWT token to get user ID
    let userId: string | null = null;
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(
          atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
        );
        userId = payload.sub || payload.user_id || null;
      }
    } catch (e) {
      console.error('Error decoding token:', e);
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Invalid token format' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user exists using admin client
    const { data: authUser, error: userError } = await supabaseClient.auth.admin.getUserById(userId);

    if (userError || !authUser?.user) {
      console.error('User verification error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: 'User not found or invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const analystId = userId;

    // Get user's organization
    const { data: membership, error: membershipError } = await supabaseClient
      .from('user_organization_membership')
      .select('organization_id')
      .eq('user_id', analystId)
      .single();

    if (membershipError || !membership) {
      return new Response(
        JSON.stringify({ error: 'User must belong to an organization' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const orgId = membership.organization_id;

    // Parse request body
    const { query, filters, report_ids } = await req.json();

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'query parameter is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[RAG Query] User: ${analystId}, Org: ${orgId}, Query: "${query}"`);

    const startTime = Date.now();

    // Build database query for reports
    let dbQuery = supabaseClient
      .from('research_reports')
      .select('id, title, original_filename, gemini_file_id, gemini_vector_store_id, sector, tickers, parsed, created_at')
      .eq('org_id', orgId)
      .eq('upload_status', 'parsed'); // Only query parsed reports

    // Apply filters if provided
    if (filters) {
      if (filters.sector) {
        dbQuery = dbQuery.eq('sector', filters.sector);
      }
      if (filters.tickers && Array.isArray(filters.tickers) && filters.tickers.length > 0) {
        dbQuery = dbQuery.overlaps('tickers', filters.tickers);
      }
      if (filters.date_from) {
        dbQuery = dbQuery.gte('created_at', filters.date_from);
      }
      if (filters.date_to) {
        dbQuery = dbQuery.lte('created_at', filters.date_to);
      }
    }

    // If specific report IDs provided, filter to those
    if (report_ids && Array.isArray(report_ids) && report_ids.length > 0) {
      dbQuery = dbQuery.in('id', report_ids);
    }

    // Fetch reports
    const { data: reports, error: reportsError } = await dbQuery;

    if (reportsError) {
      console.error('[RAG Query] Database error:', reportsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch reports', details: reportsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!reports || reports.length === 0) {
      return new Response(
        JSON.stringify({
          answer: 'No reports found matching your criteria. Please upload reports or adjust your filters.',
          citations: [],
          relevant_reports: [],
          query_time_ms: Date.now() - startTime,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[RAG Query] Found ${reports.length} reports to query`);

    // All reports in same org share the same File Search Store
    const fileSearchStoreId = reports[0]?.gemini_vector_store_id;

    if (!fileSearchStoreId) {
      console.error('[RAG Query] No File Search Store ID found in reports');
      return new Response(
        JSON.stringify({
          answer: 'No indexed reports found. Reports may still be processing.',
          citations: [],
          relevant_reports: [],
          query_time_ms: Date.now() - startTime,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[RAG Query] Using File Search Store: ${fileSearchStoreId}`);

    // Create report ID to metadata mapping
    const reportMap = new Map(
      reports.map(r => [
        r.id,
        {
          id: r.id,
          title: r.title,
          filename: r.original_filename,
        },
      ])
    );

    // Query Gemini RAG using File Search Store
    console.log(`[RAG Query] Querying ${reports.length} reports via File Search...`);
    console.log(`[RAG Query] Query: "${query.substring(0, 100)}${query.length > 100 ? '...' : ''}"`);

    const ragResponse = await queryGeminiRAG(query, fileSearchStoreId, {
      sector: filters?.sector,
      tickers: filters?.tickers,
      org_id: orgId,
    });

    const queryTime = Date.now() - startTime;
    console.log(`[RAG Query] Query completed in ${queryTime}ms`);

    // Enhance citations with report metadata
    const enhancedCitations = ragResponse.citations.map(citation => {
      // Try to match citation source to report
      let reportId = null;
      let reportTitle = null;

      // Check if source matches any report filename or title
      if (citation.source) {
        for (const [uri, metadata] of reportMap.entries()) {
          if (
            citation.source.includes(metadata.filename) ||
            citation.source.includes(metadata.title) ||
            uri.includes(citation.source)
          ) {
            reportId = metadata.id;
            reportTitle = metadata.title;
            break;
          }
        }
      }

      return {
        ...citation,
        report_id: reportId,
        title: reportTitle,
      };
    });

    // Map relevant reports to IDs
    const relevantReportIds = reports
      .filter(r => {
        const uri = r.gemini_vector_store_id || r.gemini_file_id;
        return ragResponse.relevant_reports.some(rr =>
          rr.includes(uri) || rr.includes(r.title) || rr.includes(r.original_filename)
        );
      })
      .map(r => r.id);

    // Log query to database for analytics
    try {
      await supabaseClient.from('report_queries').insert({
        org_id: orgId,
        analyst_id: analystId,
        query_text: query,
        response_summary: ragResponse.answer.substring(0, 500), // First 500 chars
        response_full: {
          answer: ragResponse.answer,
          citations: enhancedCitations,
          relevant_reports: relevantReportIds,
        },
        report_ids_used: relevantReportIds,
        filters_applied: filters || null,
        execution_time_ms: queryTime,
      });
    } catch (logError) {
      console.error('[RAG Query] Failed to log query:', logError);
      // Non-critical, continue
    }

    return new Response(
      JSON.stringify({
        answer: ragResponse.answer,
        citations: enhancedCitations,
        relevant_reports: reports
          .filter(r => relevantReportIds.includes(r.id))
          .map(r => ({
            id: r.id,
            title: r.title,
            sector: r.sector,
            tickers: r.tickers,
            created_at: r.created_at,
          })),
        graphs: ragResponse.graphs || [],
        query_time_ms: queryTime,
        total_reports_searched: reports.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[RAG Query] Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Query failed',
        details: error.message,
        stack: error.stack,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

