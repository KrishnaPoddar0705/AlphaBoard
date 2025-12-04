// Edge Function: parse-research-report
// Purpose: Parse uploaded PDF using Gemini with structured extraction

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { parseReportWithGemini } from '../_shared/gemini-client.ts';
import { RESEARCH_REPORT_EXTRACTION_PROMPT } from '../_shared/prompts.ts';

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

  let reportId: string | null = null;

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for background operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Parse request body
    const { report_id, gemini_file_uri, gemini_file_store_id } = await req.json();
    
    // Store reportId for error handling
    reportId = report_id;

    console.log('[Parse] ========================================');
    console.log('[Parse] PARSE REQUEST RECEIVED');
    console.log(`[Parse] Report ID: ${report_id}`);
    console.log(`[Parse] File URI: ${gemini_file_uri}`);
    console.log(`[Parse] Store ID: ${gemini_file_store_id}`);
    console.log('[Parse] ========================================');

    if (!report_id) {
      return new Response(
        JSON.stringify({ error: 'report_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch report from database
    console.log(`[Parse] Fetching report from database...`);
    const { data: report, error: fetchError } = await supabaseClient
      .from('research_reports')
      .select('*')
      .eq('id', report_id)
      .single();

    if (fetchError || !report) {
      console.error(`[Parse] Report not found:`, fetchError);
      return new Response(
        JSON.stringify({ error: 'Report not found', details: fetchError?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Parse] Report found: ${report.title}`);
    console.log(`[Parse] Current status: ${report.upload_status}`);

    // Check if already parsed
    if (report.parsed && Object.keys(report.parsed).length > 0) {
      console.log(`[Parse] Report already parsed, returning cached data`);
      return new Response(
        JSON.stringify({
          success: true,
          report_id: report_id,
          status: 'already_parsed',
          parsed_data: report.parsed,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get File Search Store ID (all reports in org share same store)
    const storeId = gemini_file_store_id || report.gemini_vector_store_id;

    if (!storeId) {
      console.error('[Parse] No File Search Store ID available!');
      console.error('[Parse] Report data:', JSON.stringify(report));
      
      // Update to failed
      await supabaseClient
        .from('research_reports')
        .update({ 
          upload_status: 'failed',
          error_message: 'No File Search Store ID. File may not be indexed yet.'
        })
        .eq('id', report_id);

      return new Response(
        JSON.stringify({ error: 'Report not yet indexed in Gemini. Please wait for indexing to complete.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Gemini] Using File Search Store: ${storeId}`);

    // Update status to parsing
    console.log(`[Parse] Updating status to 'parsing'...`);
    const { error: statusUpdateError } = await supabaseClient
      .from('research_reports')
      .update({ upload_status: 'parsing' })
      .eq('id', report_id);

    if (statusUpdateError) {
      console.error('[Parse] Failed to update status:', statusUpdateError);
    }

    // Parse with Gemini using File Search
    console.log(`[Parse] ========================================`);
    console.log(`[Parse] CALLING GEMINI API WITH FILE SEARCH`);
    console.log(`[Parse] Store: ${storeId}`);
    console.log(`[Parse] Prompt length: ${RESEARCH_REPORT_EXTRACTION_PROMPT.length} chars`);
    console.log(`[Parse] ========================================`);
    
    const startTime = Date.now();

    const parsedData = await parseReportWithGemini(
      storeId,
      RESEARCH_REPORT_EXTRACTION_PROMPT,
      report_id
    );

    const parseTime = Date.now() - startTime;
    console.log(`[Parse] ========================================`);
    console.log(`[Parse] GEMINI RESPONSE RECEIVED`);
    console.log(`[Parse] Parse time: ${parseTime}ms (${(parseTime / 1000).toFixed(1)}s)`);
    console.log(`[Parse] Parsed data keys: ${Object.keys(parsedData).join(', ')}`);
    console.log(`[Parse] ========================================`);

    // Add report_id to parsed data
    parsedData.report_id = report_id;

    // Update report with parsed data
    const { error: updateError } = await supabaseClient
      .from('research_reports')
      .update({
        parsed: parsedData,
        upload_status: 'parsed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', report_id);

    if (updateError) {
      console.error('[Parse] Failed to update report:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to save parsed data', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Parse] Report successfully parsed and saved`);

    return new Response(
      JSON.stringify({
        success: true,
        report_id: report_id,
        status: 'parsed',
        parsed_data: parsedData,
        parse_time_ms: parseTime,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Parse] Error:', error);

    // Try to update report status to failed
    try {
      if (reportId) {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        );
        
        await supabaseClient
          .from('research_reports')
          .update({
            upload_status: 'failed',
            error_message: error.message,
          })
          .eq('id', reportId);
      }
    } catch (updateError) {
      console.error('[Parse] Failed to update error status:', updateError);
    }

    return new Response(
      JSON.stringify({
        error: 'Failed to parse report',
        details: error.message,
        stack: error.stack,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
