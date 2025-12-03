// Edge Function: upload-research-report
// Purpose: Upload research PDF, store in Supabase Storage, index in Gemini

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { uploadToGemini, GeminiFileMetadata } from '../_shared/gemini-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

    // Verify user exists in auth.users using admin client
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
        JSON.stringify({ error: 'User must belong to an organization to upload reports' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const orgId = membership.organization_id;

    console.log(`[Upload] Processing upload for user ${analystId}, org ${orgId}`);

    // Parse multipart form data using FormData API
    const contentType = req.headers.get('content-type') || '';
    
    if (!contentType.includes('multipart/form-data')) {
      return new Response(
        JSON.stringify({ error: 'Content-Type must be multipart/form-data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (e) {
      console.error('[Upload] Error parsing form data:', e);
      return new Response(
        JSON.stringify({ error: 'Failed to parse form data', details: e.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the uploaded file
    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return new Response(
        JSON.stringify({ error: 'No file uploaded. Please select a PDF file.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const originalFilename = file.name || 'report.pdf';

    // Validate file type
    if (!originalFilename.toLowerCase().endsWith('.pdf')) {
      return new Response(
        JSON.stringify({ error: 'Only PDF files are supported' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize filename - remove special characters that cause issues with storage
    // Keep only: letters, numbers, spaces, hyphens, underscores, periods
    const sanitizedFilename = originalFilename
      .replace(/[^\w\s\-\.]/g, '_')  // Replace special chars with underscore
      .replace(/\s+/g, '_')           // Replace spaces with underscore
      .replace(/_+/g, '_');           // Replace multiple underscores with single

    console.log(`[Upload] Original filename: ${originalFilename}`);
    console.log(`[Upload] Sanitized filename: ${sanitizedFilename}`);

    // Read file as array buffer
    const fileBuffer = new Uint8Array(await file.arrayBuffer());

    // Extract metadata from form
    const title = formData.get('title')?.toString() || originalFilename.replace('.pdf', '');
    const sector = formData.get('sector')?.toString() || '';
    const tickersString = formData.get('tickers')?.toString() || '';
    const tickers = tickersString ? tickersString.split(',').map((t: string) => t.trim()) : [];

    console.log(`[Upload] Title: ${title}, Sector: ${sector}, Tickers: ${tickers.join(', ')}`);

    // Generate report ID
    const reportId = crypto.randomUUID();

    // Define storage path: {org_id}/{report_id}/{sanitized_filename}
    const storagePath = `${orgId}/${reportId}/${sanitizedFilename}`;

    // Upload to Supabase Storage
    console.log(`[Upload] Uploading to Supabase Storage: ${storagePath}`);
    
    const { data: storageData, error: storageError } = await supabaseClient.storage
      .from('research-reports')
      .upload(storagePath, fileBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (storageError) {
      console.error('[Upload] Storage error:', storageError);
      return new Response(
        JSON.stringify({ error: 'Failed to upload to storage', details: storageError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Upload] File uploaded to storage successfully`);

    // Insert initial record into database
    const { data: reportRecord, error: insertError } = await supabaseClient
      .from('research_reports')
      .insert({
        id: reportId,
        org_id: orgId,
        analyst_id: analystId,
        title: title,
        original_filename: originalFilename,
        sector: sector || null,
        tickers: tickers.length > 0 ? tickers : null,
        storage_path: storagePath,
        file_size_bytes: fileBuffer.length,
        upload_status: 'uploaded',
      })
      .select()
      .single();

    if (insertError) {
      console.error('[Upload] Database insert error:', insertError);
      
      // Cleanup: delete from storage
      await supabaseClient.storage
        .from('research-reports')
        .remove([storagePath]);

      return new Response(
        JSON.stringify({ error: 'Failed to create report record', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Upload] Report record created: ${reportId}`);

    // Upload to Gemini for indexing (async - don't block response)
    try {
      console.log(`[Upload] Starting Gemini upload...`);
      
      // Update status to indexing
      await supabaseClient
        .from('research_reports')
        .update({ upload_status: 'indexing' })
        .eq('id', reportId);

      const metadata: GeminiFileMetadata = {
        org_id: orgId,
        analyst_id: analystId,
        sector: sector,
        tickers: tickers,
        report_id: reportId,
        filename: originalFilename,
      };

      console.log(`[Upload] Calling uploadToGemini...`);
      
      const { fileId, uri, storeId } = await uploadToGemini(
        fileBuffer,
        sanitizedFilename,  // Use sanitized filename for Gemini too
        metadata
      );

      console.log(`[Upload] Gemini upload successful!`);
      console.log(`[Upload] - File ID: ${fileId}`);
      console.log(`[Upload] - URI: ${uri}`);
      console.log(`[Upload] - Store ID: ${storeId}`);

      // Update report with Gemini IDs
      const { error: updateError } = await supabaseClient
        .from('research_reports')
        .update({
          gemini_file_id: fileId,
          gemini_vector_store_id: storeId,  // Store the File Search Store ID (fileSearchStores/xxx)
          upload_status: 'indexed',
        })
        .eq('id', reportId);

      if (updateError) {
        console.error('[Upload] Failed to update report with Gemini IDs:', updateError);
      } else {
        console.log(`[Upload] Report status updated to 'indexed'`);
      }

      // Trigger parsing by directly calling parseReportWithGemini
      // Note: We do this inline instead of calling another edge function to avoid 404 issues
      console.log(`[Upload] Starting inline parsing with Gemini...`);
      
      try {
        // Import parse function directly
        const { parseReportWithGemini } = await import('../_shared/gemini-client.ts');
        const { RESEARCH_REPORT_EXTRACTION_PROMPT } = await import('../_shared/prompts.ts');
        
        // Update status to parsing
        await supabaseClient
          .from('research_reports')
          .update({ upload_status: 'parsing' })
          .eq('id', reportId);
        
        console.log(`[Upload] Calling parseReportWithGemini...`);
        
        const parsedData = await parseReportWithGemini(
          storeId,
          RESEARCH_REPORT_EXTRACTION_PROMPT,
          reportId
        );
        
        parsedData.report_id = reportId;
        
        console.log(`[Upload] Parse successful, updating database...`);
        
        // Update report with parsed data
        await supabaseClient
          .from('research_reports')
          .update({
            parsed: parsedData,
            upload_status: 'parsed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', reportId);
        
        console.log(`[Upload] Report parsed and saved successfully!`);
        
      } catch (parseError: any) {
        console.error('[Upload] Parsing failed:', parseError);
        
        // Update status to failed
        await supabaseClient
          .from('research_reports')
          .update({
            upload_status: 'failed',
            error_message: `Parse failed: ${parseError.message}`,
          })
          .eq('id', reportId);
      }

      console.log(`[Upload] Parse job trigger sent (async)`);

    } catch (geminiError) {
      console.error('[Upload] Gemini upload error:', geminiError);
      
      // Update status to failed but don't delete the record
      await supabaseClient
        .from('research_reports')
        .update({
          upload_status: 'failed',
          error_message: geminiError.message,
        })
        .eq('id', reportId);

      // Return success for storage upload even if Gemini failed
      // User can retry Gemini indexing later
    }

    return new Response(
      JSON.stringify({
        success: true,
        report_id: reportId,
        title: title,
        status: 'uploaded',
        message: 'Report uploaded successfully. Indexing and parsing in progress.',
        report: reportRecord,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Upload] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error.message,
        stack: error.stack,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

