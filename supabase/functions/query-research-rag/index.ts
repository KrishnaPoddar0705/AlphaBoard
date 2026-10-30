// Edge Function: query-research-rag
// Purpose: Query research reports using Enhanced RAG with query rewrite, multi-query retrieval, reranking, and evidence-first answering

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { queryGeminiRAG, generateEvidenceFirstAnswer } from '../_shared/gemini-client.ts';
import { rewriteQuery } from '../_shared/rag/query-rewrite.ts';
import type { ChatTurn } from '../_shared/rag/types.ts';
import { locateExcerpt } from '../_shared/rag/locate-excerpt.ts';
import { multiQueryRetrieve } from '../_shared/rag/multi-retrieve.ts';
import { rerankChunks } from '../_shared/rag/rerank.ts';
import { normalizeQuestion, sha256Hash, checkCache, cacheAnswer } from '../_shared/rag/cache.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, origin',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const HISTORY_MESSAGES = 6; // last 3 turns
const HISTORY_ANSWER_CHARS = 500;
const TITLE_CHARS = 60;

/** Lowercase letters and digits only, so "My Report.pdf" and "My_Report.pdf" compare equal. */
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Does a document label from the model (a file name or title) refer to this report? */
function labelMatchesReport(label: string | undefined, report: { filename?: string; title?: string }): boolean {
  const l = squash(label || '');
  if (l.length < 6) return false;
  return [report.filename, report.title].some((name) => {
    const n = squash(name || '');
    return n.length >= 6 && (n === l || n.includes(l) || l.includes(n));
  });
}

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

/** Prior messages of a thread, oldest first, with assistant turns shortened to their direct answer. */
async function loadHistory(supabaseClient: any, conversationId: string): Promise<ChatTurn[]> {
  const { data, error } = await supabaseClient
    .from('research_messages')
    .select('role, content, response')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_MESSAGES);
  if (error || !data) {
    console.warn('[RAG Query] Failed to load history:', error?.message);
    return [];
  }
  return data.reverse().map((m: any) => {
    const text: string = m.role === 'assistant'
      ? (m.response?.enhanced_answer?.direct_answer || m.content || '')
      : m.content;
    return {
      role: m.role,
      content: m.role === 'assistant' ? text.substring(0, HISTORY_ANSWER_CHARS) : text,
    };
  });
}

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
    const { query, filters, report_ids, conversation_id } = await req.json();

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'query parameter is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[RAG Query] ========================================`);
    console.log(`[RAG Query] QUERY START`);
    console.log(`[RAG Query] User: ${analystId}`);
    console.log(`[RAG Query] Org: ${orgId}`);
    console.log(`[RAG Query] Query: "${query}"`);
    console.log(`[RAG Query] Filters:`, JSON.stringify(filters || {}));
    console.log(`[RAG Query] ========================================`);

    const startTime = Date.now();

    // Resolve the conversation. This function uses the service role, so this lookup is the
    // access control: a thread is only usable by the user and org that own it.
    let conversationId: string | null = null;
    let conversationTitle: string | null = null;
    let history: ChatTurn[] = [];
    if (conversation_id) {
      const { data: convo } = await supabaseClient
        .from('research_conversations')
        .select('id, title')
        .eq('id', conversation_id)
        .eq('user_id', analystId)
        .eq('org_id', orgId)
        .maybeSingle();
      if (!convo) {
        return new Response(
          JSON.stringify({ error: 'Conversation not found' }),
          { status: 404, headers: jsonHeaders }
        );
      }
      conversationId = convo.id;
      conversationTitle = convo.title;
      history = await loadHistory(supabaseClient, convo.id);
    }

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
          gemini_file_id: r.gemini_file_id,
          gemini_vector_store_id: r.gemini_vector_store_id,
        },
      ])
    );

    // Create mapping from Gemini file URIs/IDs to report IDs
    // Gemini file URIs can be in formats like:
    // - files/{fileId}
    // - {fileId}
    // - fileSearchStores/{storeId}/documents/{documentId}
    const fileUriToReportId = new Map<string, string>();
    for (const report of reports) {
      if (report.gemini_file_id) {
        // Add various URI formats that Gemini might return
        fileUriToReportId.set(`files/${report.gemini_file_id}`, report.id);
        fileUriToReportId.set(report.gemini_file_id, report.id);
        // Also try matching just the file ID part
        const fileIdParts = report.gemini_file_id.split('/');
        if (fileIdParts.length > 0) {
          fileUriToReportId.set(fileIdParts[fileIdParts.length - 1], report.id);
        }
      }
      // Also map by store ID + document pattern if available
      if (report.gemini_vector_store_id && report.gemini_file_id) {
        const storeName = report.gemini_vector_store_id.replace('fileSearchStores/', '');
        fileUriToReportId.set(`${report.gemini_vector_store_id}/documents/${report.gemini_file_id}`, report.id);
      }
    }
    
    console.log(`[RAG Query] Created file URI mapping: ${fileUriToReportId.size} entries`);

    // ========================================
    // ENHANCED RAG PIPELINE
    // ========================================

    // Save the exchange to the thread (creating the thread on a first message) and build the
    // HTTP response. The body is a superset of the old one, so RAGSearchBar keeps working.
    const respondAndPersist = async (payload: any, cacheHeader?: string, standalone?: string): Promise<Response> => {
      const reportIdsUsed: string[] = (payload.relevant_reports || [])
        .map((r: any) => (typeof r === 'string' ? r : r?.id))
        .filter(Boolean);
      let messageId: string | null = null;
      try {
        if (!conversationId) {
          const { data: created, error: createError } = await supabaseClient
            .from('research_conversations')
            .insert({
              org_id: orgId,
              user_id: analystId,
              title: query.trim().substring(0, TITLE_CHARS),
              filters: filters || null,
            })
            .select('id, title')
            .single();
          if (createError) throw createError;
          conversationId = created.id;
          conversationTitle = created.title;
        }
        const now = Date.now();
        const { data: inserted, error: msgError } = await supabaseClient
          .from('research_messages')
          .insert([
            {
              conversation_id: conversationId,
              role: 'user',
              content: query,
              scope_report_ids: Array.isArray(report_ids) && report_ids.length > 0 ? report_ids : null,
              created_at: new Date(startTime).toISOString(),
            },
            {
              conversation_id: conversationId,
              role: 'assistant',
              content: payload.answer,
              response: payload,
              standalone_question: standalone || null,
              report_ids_used: reportIdsUsed,
              execution_time_ms: now - startTime,
              created_at: new Date(Math.max(now, startTime + 1)).toISOString(),
            },
          ])
          .select('id, role');
        if (msgError) throw msgError;
        messageId = inserted?.find((m: any) => m.role === 'assistant')?.id || null;
        await supabaseClient
          .from('research_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversationId);
      } catch (persistError: any) {
        // The answer is still good; the thread just won't have it saved.
        console.error('[RAG Query] Failed to save conversation:', persistError?.message || persistError);
      }
      const headers: Record<string, string> = { ...jsonHeaders };
      if (cacheHeader) headers['X-Cache'] = cacheHeader;
      return new Response(
        JSON.stringify({ ...payload, conversation_id: conversationId, message_id: messageId, title: conversationTitle }),
        { status: 200, headers }
      );
    };

    // Step 0: Cache check. A first message is keyed on its own text. A follow-up is only
    // meaningful with its history ("and margins?"), so it is keyed after the rewrite on the
    // standalone question instead (see Step 1).
    const scopeKey = JSON.stringify([filters || null, [...(report_ids || [])].sort()]);
    let questionHash = await sha256Hash(normalizeQuestion(query) + scopeKey);
    if (history.length === 0) {
      const cachedResponse = await checkCache(orgId, questionHash, supabaseClient);
      if (cachedResponse) {
        console.log(`[RAG Query] Cache hit - returning cached response`);
        return await respondAndPersist(await cachedResponse.json(), cachedResponse.headers.get('X-Cache') || 'HIT');
      }
    }

    let enhancedResponse: any = null;
    let queryObject: any = null;
    let retrievedChunks: any[] = [];
    let rankedChunks: any[] = [];
    let lastError: Error | null = null;
    // Tickers the reports in scope were tagged with, as a hint for writing company names
    const knownTickers = [...new Set(
      reports.flatMap((r: any) => r.tickers || []).map((t: string) => String(t).trim().toUpperCase()).filter(Boolean)
    )] as string[];
    let question: string = query; // what retrieval/answering actually use (standalone for follow-ups)

    try {
      // Step 1: Query rewrite
      console.log(`[RAG Query] Step 1: Query rewrite...`);
      queryObject = await rewriteQuery(query, {
        sector: filters?.sector,
        tickers: filters?.tickers,
        date_from: filters?.date_from,
        date_to: filters?.date_to,
      }, history);
      console.log(`[RAG Query] Query rewrite complete: intent=${queryObject.intent}, subqueries=${queryObject.subqueries.length}`);
      question = queryObject.standalone_question || query;
      if (history.length > 0) {
        console.log(`[RAG Query] Standalone question: "${question}"`);
        questionHash = await sha256Hash(normalizeQuestion(question) + scopeKey);
        const cachedResponse = await checkCache(orgId, questionHash, supabaseClient);
        if (cachedResponse) {
          return await respondAndPersist(await cachedResponse.json(), 'HIT');
        }
      }

      // Step 2: Multi-query retrieval
      console.log(`[RAG Query] Step 2: Multi-query retrieval (${queryObject.subqueries.length} subqueries)...`);
      retrievedChunks = await multiQueryRetrieve(queryObject.subqueries, fileSearchStoreId, orgId);
      console.log(`[RAG Query] Retrieved ${retrievedChunks.length} chunks`);

      if (retrievedChunks.length === 0) {
        throw new Error('No chunks retrieved from multi-query search');
      }

      // The File Search store covers the whole org, so narrowing to chosen reports happens
      // here, by matching each chunk's document title to the chosen reports. If nothing
      // matches (titles can differ from what Gemini returns), keep everything.
      if (Array.isArray(report_ids) && report_ids.length > 0) {
        const wanted = reports.map((r: any) => [r.title, r.original_filename]).flat().filter(Boolean).map((t: string) => t.toLowerCase());
        const scoped = retrievedChunks.filter((c: any) => {
          const t = (c.documentTitle || '').toLowerCase();
          return t && wanted.some((w: string) => w.includes(t) || t.includes(w));
        });
        if (scoped.length > 0) {
          console.log(`[RAG Query] Scoped to chosen reports: ${scoped.length}/${retrievedChunks.length} chunks`);
          retrievedChunks = scoped;
        }
      }

      // Step 3: Rerank
      console.log(`[RAG Query] Step 3: Reranking top ${Math.min(50, retrievedChunks.length)} candidates...`);
      rankedChunks = await rerankChunks(question, retrievedChunks, 10);
      console.log(`[RAG Query] Reranked to top ${rankedChunks.length} chunks`);

      if (rankedChunks.length === 0) {
        throw new Error('No chunks after reranking');
      }

      // Step 4: Evidence-first answer generation
      console.log(`[RAG Query] Step 4: Evidence-first answer generation...`);
      enhancedResponse = await generateEvidenceFirstAnswer(
        question,
        rankedChunks,
        queryObject.required_sections || ['Direct Answer', 'Detailed Breakdown'],
        fileSearchStoreId,
        knownTickers
      );
      console.log(`[RAG Query] Answer generated: length=${enhancedResponse.answer.length}`);

    } catch (error: any) {
      lastError = error;
      console.error(`[RAG Query] Enhanced pipeline error: ${error.message}`);
      console.error(`[RAG Query] Falling back to legacy queryGeminiRAG...`);

      // Fallback to legacy pipeline
      try {
        const legacyResponse = await queryGeminiRAG(question, fileSearchStoreId, {
          sector: filters?.sector,
          tickers: filters?.tickers,
          org_id: orgId,
        });

        // Convert legacy response to enhanced format
        enhancedResponse = {
          answer: legacyResponse.answer,
          citations: legacyResponse.citations || [],
          relevant_reports: legacyResponse.relevant_reports || [],
          graphs: legacyResponse.graphs || [],
          enhanced_answer: undefined, // Not available in legacy
          evidence: [],
          missing_info: [],
        };
        console.log(`[RAG Query] Legacy pipeline succeeded`);
      } catch (legacyError: any) {
        console.error(`[RAG Query] Legacy pipeline also failed: ${legacyError.message}`);
        const queryTime = Date.now() - startTime;
        return new Response(
          JSON.stringify({
            answer: `Unable to process query. Enhanced pipeline error: ${error.message}. Legacy pipeline error: ${legacyError.message}`,
            citations: [],
            relevant_reports: [],
            graphs: [],
            query_time_ms: queryTime,
            total_reports_searched: reports.length,
            error: error.message,
            pipeline_failed: true,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!enhancedResponse || !enhancedResponse.answer || enhancedResponse.answer.trim().length === 0) {
      const queryTime = Date.now() - startTime;
      console.error(`[RAG Query] Invalid response from pipeline`);
      return new Response(
        JSON.stringify({
          answer: `Unable to get a valid response from the AI. ${lastError ? `Error: ${lastError.message}` : 'Unknown error'}`,
          citations: [],
          relevant_reports: [],
          graphs: [],
          query_time_ms: queryTime,
          total_reports_searched: reports.length,
          pipeline_failed: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const queryTime = Date.now() - startTime;
    console.log(`[RAG Query] Pipeline completed in ${queryTime}ms`);

    // Validate response structure
    if (!enhancedResponse.answer || typeof enhancedResponse.answer !== 'string' || enhancedResponse.answer.trim().length === 0) {
      console.error('[RAG Query] Response validation failed: empty answer');
      return new Response(
        JSON.stringify({
          answer: 'The AI response was empty. This may indicate the File Search Store needs indexing or the query needs refinement.',
          citations: [],
          relevant_reports: [],
          graphs: [],
          query_time_ms: queryTime,
          total_reports_searched: reports.length,
          pipeline_failed: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ensure arrays exist
    if (!Array.isArray(enhancedResponse.citations)) {
      console.warn('[RAG Query] Citations is not an array, defaulting to empty array');
      enhancedResponse.citations = [];
    }
    if (!Array.isArray(enhancedResponse.evidence)) {
      enhancedResponse.evidence = [];
    }
    if (!Array.isArray(enhancedResponse.missing_info)) {
      enhancedResponse.missing_info = [];
    }
    if (!Array.isArray(enhancedResponse.relevant_reports)) {
      enhancedResponse.relevant_reports = [];
    }
    if (!Array.isArray(enhancedResponse.graphs)) {
      enhancedResponse.graphs = [];
    }

    // Minimum quality check
    const minAnswerLength = 200;
    if (enhancedResponse.answer.trim().length < minAnswerLength) {
      console.warn(`[RAG Query] Answer is too short (${enhancedResponse.answer.trim().length} chars), minimum expected: ${minAnswerLength}`);
    }

    console.log(`[RAG Query] Response validated: answer length=${enhancedResponse.answer.length}, citations=${enhancedResponse.citations?.length || 0}`);

    // Step 5: Enhance citations with report metadata
    const enhancedCitations = enhancedResponse.citations.map((citation: any) => {
      let reportId = null;
      let reportTitle = null;

      // First, try to match using fileUri from grounding metadata (most reliable)
      if (citation.fileUri) {
        // Try exact match
        reportId = fileUriToReportId.get(citation.fileUri) || null;
        
        // Try partial matches (URI might contain the file ID)
        if (!reportId) {
          for (const [uri, reportIdValue] of fileUriToReportId.entries()) {
            if (citation.fileUri.includes(uri) || uri.includes(citation.fileUri)) {
              reportId = reportIdValue;
              break;
            }
          }
        }
        
        // Try extracting file ID from URI and matching
        if (!reportId) {
          const uriParts = citation.fileUri.split('/');
          for (const part of uriParts) {
            if (part && fileUriToReportId.has(part)) {
              reportId = fileUriToReportId.get(part)!;
              break;
            }
          }
        }
      }

      // Fallback: match the document label to a report's file name or title. Gemini's own
      // `source` is often empty; the citation's `doc` carries the file name it quoted from.
      if (!reportId) {
        for (const [reportIdValue, metadata] of reportMap.entries()) {
          if (labelMatchesReport(citation.source, metadata) || labelMatchesReport(citation.doc, metadata)) {
            reportId = reportIdValue;
            reportTitle = metadata.title;
            break;
          }
        }
      }

      // Get report title if we found a report ID
      if (reportId && !reportTitle) {
        const metadata = reportMap.get(reportId);
        reportTitle = metadata?.title || null;
      }

      return {
        ...citation,
        report_id: reportId,
        title: reportTitle,
      };
    });

    // Place each quote in the report's stored page text: gives the true page and the report's
    // own wording. Best effort; a citation that can't be placed keeps Gemini's quote.
    try {
      const citedReportIds = [...new Set(enhancedCitations.map((c: any) => c.report_id).filter(Boolean))];
      if (citedReportIds.length > 0) {
        const { data: pageRows, error: pagesError } = await supabaseClient
          .from('research_report_chunks')
          .select('report_id, page_number, content')
          .in('report_id', citedReportIds);
        if (pagesError) throw pagesError;
        let located = 0;
        for (const citation of enhancedCitations) {
          if (!citation.report_id || !citation.excerpt) continue;
          const pages = (pageRows || []).filter((p: any) => p.report_id === citation.report_id);
          const hit = locateExcerpt(citation.excerpt, pages);
          const refPage = parseInt(String(citation.ref || '').match(/\d+/)?.[0] || '', 10);
          if (!citation.page && refPage > 0) citation.page = refPage;
          if (hit) {
            citation.page = hit.page;
            citation.passage = hit.passage;
            citation.passage_hit = hit.hit;
            located++;
          }
        }
        console.log(`[RAG Query] Located ${located}/${enhancedCitations.length} citations in page text`);
      }
    } catch (locateError: any) {
      console.warn('[RAG Query] Could not locate citations in page text:', locateError?.message || locateError);
    }

    console.log(`[RAG Query] Enhanced ${enhancedCitations.length} citations, ${enhancedCitations.filter(c => c.report_id).length} matched to reports`);

    // Map relevant reports using citations and evidence
    const relevantReportIds = new Set<string>();
    
    // Method 1: Extract from ranked chunks (most reliable)
    for (const chunk of rankedChunks) {
      if (chunk.documentUri) {
        const reportId = fileUriToReportId.get(chunk.documentUri);
        if (reportId) {
          relevantReportIds.add(reportId);
          continue;
        }
        // Try partial matches
        for (const [uri, reportIdValue] of fileUriToReportId.entries()) {
          if (chunk.documentUri.includes(uri) || uri.includes(chunk.documentUri)) {
            relevantReportIds.add(reportIdValue);
            break;
          }
        }
      }
    }

    // Method 2: Use citations with report IDs
    for (const citation of enhancedCitations) {
      if (citation.report_id) {
        relevantReportIds.add(citation.report_id);
      }
    }

    // Method 3: Use evidence document references
    if (enhancedResponse.evidence) {
      for (const evidence of enhancedResponse.evidence) {
        for (const [reportIdValue, metadata] of reportMap.entries()) {
          if (labelMatchesReport(evidence.doc, metadata)) {
            relevantReportIds.add(reportIdValue);
            break;
          }
        }
      }
    }

    // Fallback: If no reports matched, include all searched reports (they were all used)
    if (relevantReportIds.size === 0) {
      console.log('[RAG Query] No reports matched from grounding metadata, using all searched reports as fallback');
      reports.forEach(r => relevantReportIds.add(r.id));
    }

    const finalRelevantReportIds = Array.from(relevantReportIds);
    console.log(`[RAG Query] Mapped ${finalRelevantReportIds.length} relevant reports from ${relevantReportIds.size} unique matches`);

    // Step 6: Log query to database for analytics
    try {
      await supabaseClient.from('report_queries').insert({
        org_id: orgId,
        analyst_id: analystId,
        query_text: query,
        query_object: queryObject,
        subqueries: queryObject?.subqueries || [],
        retrieved_count: retrievedChunks.length,
        reranked_count: rankedChunks.length,
        retrieval_debug: {
          subqueries: queryObject?.subqueries || [],
          retrieved_count: retrievedChunks.length,
          reranked_count: rankedChunks.length,
        },
        response_summary: enhancedResponse.answer.substring(0, 500),
        response_full: {
          answer: enhancedResponse.answer,
          enhanced_answer: enhancedResponse.enhanced_answer,
          citations: enhancedCitations,
          evidence: enhancedResponse.evidence,
          missing_info: enhancedResponse.missing_info,
          relevant_reports: finalRelevantReportIds,
        },
        conversation_id: conversationId,
        report_ids_used: finalRelevantReportIds,
        filters_applied: filters || null,
        execution_time_ms: queryTime,
      });
    } catch (logError) {
      console.error('[RAG Query] Failed to log query:', logError);
      // Non-critical, continue
    }

    // Get final relevant reports with metadata
    const finalRelevantReports = reports
      .filter(r => finalRelevantReportIds.includes(r.id))
      .map(r => ({
        id: r.id,
        title: r.title,
        sector: r.sector,
        tickers: r.tickers,
        created_at: r.created_at,
      }));

    // Cache the response
    try {
      await cacheAnswer(orgId, questionHash, {
        answer: enhancedResponse.answer,
        enhanced_answer: enhancedResponse.enhanced_answer,
        citations: enhancedCitations,
        evidence: enhancedResponse.evidence,
        missing_info: enhancedResponse.missing_info,
        relevant_reports: finalRelevantReports,
        graphs: enhancedResponse.graphs || [],
        query_time_ms: queryTime,
        total_reports_searched: reports.length,
        retrieval_debug: {
          subqueries: queryObject?.subqueries || [],
          retrieved_count: retrievedChunks.length,
          reranked_count: rankedChunks.length,
        },
      }, supabaseClient);
    } catch (cacheError) {
      console.warn('[RAG Query] Failed to cache response:', cacheError);
      // Non-critical, continue
    }

    console.log(`[RAG Query] ========================================`);
    console.log(`[RAG Query] QUERY SUCCESS`);
    console.log(`[RAG Query] Answer length: ${enhancedResponse.answer.length} chars`);
    console.log(`[RAG Query] Citations: ${enhancedCitations.length} (${enhancedCitations.filter(c => c.report_id).length} matched)`);
    console.log(`[RAG Query] Evidence: ${enhancedResponse.evidence?.length || 0}`);
    console.log(`[RAG Query] Relevant reports: ${finalRelevantReports.length}`);
    console.log(`[RAG Query] Graphs: ${enhancedResponse.graphs?.length || 0}`);
    console.log(`[RAG Query] Query time: ${queryTime}ms`);
    console.log(`[RAG Query] ========================================`);

    // Build final response with enhanced fields
    const finalResponse = {
      // Legacy fields (for backward compatibility)
      answer: enhancedResponse.answer,
      citations: enhancedCitations,
      relevant_reports: finalRelevantReports,
      graphs: enhancedResponse.graphs || [],
      
      // Enhanced fields
      enhanced_answer: enhancedResponse.enhanced_answer,
      evidence: enhancedResponse.evidence || [],
      missing_info: enhancedResponse.missing_info || [],
      
      // Metadata
      query_time_ms: queryTime,
      total_reports_searched: reports.length,
      retrieval_debug: {
        subqueries: queryObject?.subqueries || [],
        retrieved_count: retrievedChunks.length,
        reranked_count: rankedChunks.length,
      },
    };

    return await respondAndPersist(finalResponse, undefined, question);

  } catch (error: any) {
    console.error('[RAG Query] ========================================');
    console.error('[RAG Query] FATAL ERROR');
    console.error('[RAG Query] Error message:', error.message);
    console.error('[RAG Query] Error stack:', error.stack);
    console.error('[RAG Query] ========================================');
    return new Response(
      JSON.stringify({
        error: 'Query failed',
        details: error.message || 'Unknown error occurred',
        answer: 'An unexpected error occurred while processing your query. Please try again.',
        citations: [],
        relevant_reports: [],
        graphs: [],
        query_time_ms: 0,
        total_reports_searched: 0,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

