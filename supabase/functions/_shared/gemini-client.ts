// Shared Gemini Client
// Purpose: Handle file uploads, parsing, and RAG queries using Google Gemini File Search API
// Using NEW SDK: @google/genai (not @google/generative-ai)

// @ts-ignore - Deno npm imports don't have built-in type declarations
import { GoogleGenAI } from 'npm:@google/genai@1.29.0';

// Import types for enhanced RAG
import type { RankedChunk, EnhancedRAGResponse } from './rag/types.ts';
import { formatContextForAnswer } from './rag/utils.ts';

// Declare Deno global for TypeScript (Supabase Edge Functions run in Deno runtime)
// @ts-ignore - Deno is available at runtime but TypeScript doesn't recognize it
declare const Deno: {
    env: {
        get(key: string): string | undefined
    }
    writeFile(path: string, data: Uint8Array): Promise<void>
    remove(path: string, options?: { recursive?: boolean }): Promise<void>
}

// Environment variables
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';
const GEMINI_MODEL = 'gemini-flash-latest'; // Latest Flash model with File Search support

console.log('[Gemini Client] Initializing Google GenAI SDK...');
console.log(`[Gemini Client] Model: ${GEMINI_MODEL}`);
console.log(`[Gemini Client] API Key configured: ${GEMINI_API_KEY ? 'YES' : 'NO'}`);

// Initialize Google GenAI client
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

export interface GeminiFileMetadata {
    org_id: string;
    analyst_id: string;
    sector?: string;
    tickers?: string[];
    report_id: string;
    filename: string;
}

export interface ParsedReport {
    report_id: string;
    title: string;
    sector_outlook: string;
    key_drivers: string[];
    company_ratings: Array<{ company: string; rating: string; rationale: string }>;
    valuation_summary: string;
    risks: string[];
    catalysts: string[];
    charts_and_tables: Array<{ description: string; page: number }>;
    price_forecasts: Array<{ asset: string; forecast: string; timeframe: string }>;
    regulatory_changes: string[];
    financial_tables: Array<{ description: string; page: number; data: any }>;
    summary_sentence: string;
    one_paragraph_thesis: string;
    three_key_insights: string[];
    three_risks: string[];
    three_catalysts: string[];
    three_actionables: string[];
    citations: Array<{ text: string; page: number; source?: string }>;
}

export interface GraphData {
    type: 'line' | 'bar' | 'pie' | 'area';
    title: string;
    xAxis?: string;
    yAxis?: string;
    data: Array<{
        [key: string]: string | number;
    }>;
    series?: Array<{
        name: string;
        data: number[];
    }>;
}

export interface RAGResponse {
    answer: string;
    citations: Array<{
        report_id?: string;
        title?: string;
        page?: number;
        excerpt: string;
        source?: string;
        fileUri?: string;
    }>;
    relevant_reports: string[];
    graphs?: GraphData[];
    _groundingMetadata?: {
        chunks: number;
        fileReferences: string[];
    };
}

/**
 * Get or create a File Search Store for an organization
 * One store per organization for multi-tenant isolation
 */
export async function getOrCreateFileSearchStore(orgId: string): Promise<string> {
    try {
        console.log(`[Gemini] Getting/creating file search store for org: ${orgId}`);

        if (!GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY not configured. Get one at: https://aistudio.google.com/apikey');
        }

        const storeDisplayName = `AlphaBoard Research - Org ${orgId}`;

        // Try to list existing stores
        try {
            const listResponse = await ai.fileSearchStores.list();
            const stores = listResponse.fileSearchStores || [];

            const existingStore = stores.find((store: any) =>
                store.displayName === storeDisplayName ||
                store.displayName?.includes(orgId)
            );

            if (existingStore) {
                console.log(`[Gemini] Found existing store: ${existingStore.name}`);
                return existingStore.name;
            }
        } catch (e) {
            console.log('[Gemini] Could not list stores, will create new one');
        }

        // Create new store
        console.log(`[Gemini] Creating new file search store: ${storeDisplayName}`);

        const created = await ai.fileSearchStores.create({
            config: { displayName: storeDisplayName },
        });

        console.log(`[Gemini] File search store created: ${created.name}`);
        return created.name;

    } catch (error: any) {
        console.error('[Gemini] Error with file search store:', error);
        throw new Error(`File search store error: ${error.message}`);
    }
}

/**
 * Upload file to Google Gemini File Search Store using NEW SDK
 */
export async function uploadToGemini(
    fileBuffer: Uint8Array,
    filename: string,
    metadata: GeminiFileMetadata
): Promise<{ fileId: string; uri: string; storeId: string }> {
    try {
        console.log(`[Gemini] Starting upload for: ${filename} (${fileBuffer.length} bytes)`);
        console.log(`[Gemini] Org ID: ${metadata.org_id}, Report ID: ${metadata.report_id}`);

        if (!GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY not configured');
        }

        // Get or create File Search Store for this organization
        const storeName = await getOrCreateFileSearchStore(metadata.org_id);
        console.log(`[Gemini] Using file search store: ${storeName}`);

        // Write to temp file for SDK upload
        const tempPath = `/tmp/${filename}`;
        await Deno.writeFile(tempPath, fileBuffer);
        console.log(`[Gemini] Wrote temp file: ${tempPath}`);

        // Upload to File Search Store using NEW SDK
        console.log(`[Gemini] Uploading to File Search Store via SDK...`);

        let operation = await ai.fileSearchStores.uploadToFileSearchStore({
            file: tempPath,
            fileSearchStoreName: storeName,
            config: {
                displayName: filename,
                mimeType: 'application/pdf',
            },
        });

        console.log(`[Gemini] Upload operation started: ${operation.name}`);
        console.log(`[Gemini] Operation done: ${operation.done}`);

        // Poll for operation completion
        const startTime = Date.now();
        const maxWaitTime = 300000; // 5 minutes
        let attempts = 0;

        while (!operation.done && (Date.now() - startTime) < maxWaitTime) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
            attempts++;

            try {
                operation = await ai.operations.get({ operation });
                console.log(`[Gemini] Polling... Done: ${operation.done} (attempt ${attempts})`);
            } catch (pollError: any) {
                console.warn(`[Gemini] Poll failed (attempt ${attempts}):`, pollError.message);
            }

            if (operation.done) {
                console.log(`[Gemini] Operation completed!`);
                break;
            }
        }

        if (!operation.done) {
            console.warn(`[Gemini] Operation not complete after ${maxWaitTime / 1000}s, but continuing`);
        }

        // Check for errors
        if (operation.error) {
            throw new Error(`File Search upload failed: ${JSON.stringify(operation.error)}`);
        }

        // Extract document info from response
        const documentName = operation.response?.name || operation.name;
        console.log(`[Gemini] Document created: ${documentName}`);

        // Cleanup temp file
        try {
            await Deno.remove(tempPath);
        } catch (e) {
            console.error('[Gemini] Failed to remove temp file:', e);
        }

        // Extract ID from document name
        const fileId = documentName.split('/').pop() || documentName;

        console.log(`[Gemini] Upload complete!`);
        console.log(`[Gemini] - File ID: ${fileId}`);
        console.log(`[Gemini] - Store: ${storeName}`);

        return {
            fileId: fileId,
            uri: documentName,
            storeId: storeName,
        };

    } catch (error: any) {
        console.error('[Gemini] Upload error:', error);
        console.error('[Gemini] Error stack:', error.stack);
        throw new Error(`Failed to upload to Gemini: ${error.message}`);
    }
}

/**
 * Parse report using Gemini with File Search (via REST API)
 */
export async function parseReportWithGemini(
    fileSearchStoreId: string,
    structuredPrompt: string,
    reportId?: string
): Promise<ParsedReport> {
    try {
        console.log(`[Gemini] Parsing report: ${reportId}`);
        console.log(`[Gemini] File Search Store: ${fileSearchStoreId}`);

        if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');

        console.log(`[Gemini] Calling generateContent via REST API with File Search...`);

        // Use v1beta REST API for File Search tool support (v1 doesn't support tools)
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

        const requestBody = {
            contents: [
                {
                    role: 'user',
                    parts: [
                        {
                            text: structuredPrompt
                        }
                    ]
                }
            ],
            tools: [
                {
                    file_search: {
                        file_search_store_names: [fileSearchStoreId]
                    }
                }
            ]
        };

        console.log(`[Gemini] Request URL (v1beta): ${url}`);
        console.log(`[Gemini] Store in request: ${fileSearchStoreId}`);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Gemini] API error:', response.status, errorText);
            throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        console.log(`[Gemini] Response received (${text.length} chars)`);

        // Clean JSON
        let jsonText = text.trim();
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
        } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '');
        }

        const parsedData = JSON.parse(jsonText);
        console.log(`[Gemini] Parsed JSON successfully`);

        return parsedData;
    } catch (error: any) {
        console.error('[Gemini] Parse error:', error);
        throw new Error(`Failed to parse report: ${error.message}`);
    }
}

/**
 * Query reports using RAG with File Search (via REST API)
 */
export async function queryGeminiRAG(
    query: string,
    fileSearchStoreId: string,
    filters?: any
): Promise<RAGResponse> {
    try {
        console.log(`[Gemini] ========================================`);
        console.log(`[Gemini] RAG QUERY START`);
        console.log(`[Gemini] Query: "${query}"`);
        console.log(`[Gemini] File Search Store: ${fileSearchStoreId}`);
        console.log(`[Gemini] Filters:`, JSON.stringify(filters || {}));
        console.log(`[Gemini] ========================================`);

        if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');

        // Build context from filters
        let contextString = '';
        if (filters?.sector) {
            contextString += `Focus on reports in sector: ${filters.sector}. `;
        }
        if (filters?.tickers && filters.tickers.length > 0) {
            contextString += `Focus on tickers: ${filters.tickers.join(', ')}. `;
        }

        const promptText = `${contextString}
Query: ${query}

You are a financial research analyst. Provide a comprehensive, detailed answer based on the research reports in the File Search Store. Your response MUST be valid JSON only - no markdown code blocks, no explanatory text, just the JSON object.

IMPORTANT: 
- Provide a COMPREHENSIVE answer that fully addresses the query with sufficient detail
- Do NOT provide brief or minimal answers - include all relevant information from the reports
- The answer should be thorough and informative, not just a summary sentence

CRITICAL OUTPUT REQUIREMENT:
- You MUST return ONLY a valid JSON object, nothing else
- Do NOT wrap the JSON in markdown code blocks (no \`\`\`json)
- Do NOT add any text before or after the JSON
- Do NOT include JSON code blocks or examples in the "answer" field - only formatted markdown text
- The response must start with { and end with }
- All strings must be properly escaped
- The "answer" field must contain ONLY markdown-formatted text, NEVER JSON code blocks or examples

OUTPUT JSON SCHEMA (strictly follow this structure):
{
  "answer": "string (markdown formatted text with inline citations [1], [2], etc.)",
  "citations": [
    {
      "excerpt": "string (relevant quote or finding)",
      "page": number (page number if available, null if not),
      "source": "string (report name or identifier)"
    }
  ],
  "relevant_reports": ["string (report identifiers)"],
  "graphs": [
    {
      "type": "line" | "bar" | "pie" | "area",
      "title": "string",
      "xAxis": "string",
      "yAxis": "string",
      "data": [{"x": "string", "y": number}],
      "series": [{"name": "string", "data": [number]}]
    }
  ]
}

EXAMPLE OUTPUT (copy this exact structure):
{
  "answer": "The research reports highlight **two major regulatory changes**[1] impacting the consumer durables sector:\n\n1. **GST Rate Cut**[1]: A Goods and Services Tax rate cut equated to approximately 10% price cut[1].\n\n2. **BEE Norms Change**[2]: New BEE norms are anticipated to cause price hikes of roughly 10%[2].",
  "citations": [
    {
      "excerpt": "A GST rate cut, which equated to an approximately 10% price cut, helped drive robust demand during the festive season.",
      "page": 5,
      "source": "Consumer Durables & Apparel Report"
    },
    {
      "excerpt": "New BEE norms are anticipated to cause price hikes of roughly 10%. The price increase in RACs following the BEE change is expected to negate the benefit of the GST rate cut.",
      "page": 8,
      "source": "Consumer Durables & Apparel Report"
    }
  ],
  "relevant_reports": ["Consumer Durables & Apparel Report"],
  "graphs": []
}

ANSWER FORMATTING (within the "answer" field):
- Use markdown: **bold**, *italic*, headers (##, ###), bullet points (-), numbered lists (1.)
- Use tables for comparative data: | Column1 | Column2 |
- **MANDATORY: Include inline citation numbers [1], [2], [3] after EVERY claim, statistic, or finding**
- Example: "Revenue growth is 15-20%[1] with strong tailwinds[2]."
- Structure logically with clear sections
- **CRITICAL: The answer field must contain ONLY markdown text - NEVER include JSON code blocks, JSON examples, or any code formatting**
- **CRITICAL: Do NOT include example JSON structures or code blocks in your answer - only formatted markdown text**

CITATION REQUIREMENTS:
- **EVERY number, forecast, statistic, or claim MUST have a citation [1], [2], [3] in the answer text**
- Citations must be numbered sequentially as they appear
- Each citation in the array must have: excerpt (exact quote), page (number or null), source (report identifier)
- Citation [1] in text = citations[0] in array (0-based indexing)

GRAPH REQUIREMENTS (optional):
- Include graphs array only if data supports visualization
- For time series: use "line" or "area" type with "series" array
- For comparisons: use "bar" type with "data" array
- For distributions: use "pie" type with "data" array

RELEVANT REPORTS:
- List all report identifiers/names that were used to answer the query
- Extract from the File Search Store results

VALIDATION CHECKLIST:
✓ Response is valid JSON (can be parsed)
✓ "answer" field exists and is non-empty string
✓ "citations" field exists and is array
✓ "relevant_reports" field exists and is array
✓ "graphs" field exists and is array
✓ All citation numbers in answer text have corresponding entries in citations array
✓ No markdown code blocks around JSON
✓ No text before or after JSON object`;

        // Use v1beta REST API for File Search tool support (v1 doesn't support tools)
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

        const requestBody = {
            contents: [
                {
                    role: 'user',
                    parts: [
                        {
                            text: promptText
                        }
                    ]
                }
            ],
            tools: [
                {
                    file_search: {
                        file_search_store_names: [fileSearchStoreId]
                    }
                }
            ],
            generationConfig: {
                temperature: 0.1, // Very low temperature for maximum consistency and reliability
                topK: 20, // Reduced for more deterministic output
                topP: 0.7, // Reduced for more focused responses
                maxOutputTokens: 8192,
                responseMimeType: 'application/json', // Force JSON output
            }
        };

        console.log(`[Gemini] Calling REST API (v1beta) for RAG query...`);

        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

        let response;
        try {
            response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
        } catch (error: any) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Request timeout after 60 seconds - the File Search Store may still be indexing');
            }
            throw error;
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Gemini] RAG API error:', response.status, errorText);
            throw new Error(`Gemini RAG error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        // Check for errors in response
        if (data.error) {
            console.error('[Gemini] API error response:', data.error);
            throw new Error(`Gemini API error: ${data.error.message || JSON.stringify(data.error)}`);
        }

        // Check if we have candidates
        if (!data.candidates || data.candidates.length === 0) {
            console.error('[Gemini] No candidates in response:', JSON.stringify(data));
            throw new Error('No response candidates from Gemini API');
        }

        // Check for finish reason
        const finishReason = data.candidates[0]?.finishReason;
        if (finishReason && finishReason !== 'STOP') {
            console.warn(`[Gemini] Finish reason: ${finishReason}`);
            if (finishReason === 'MAX_TOKENS') {
                throw new Error('Response was truncated due to token limit');
            } else if (finishReason === 'SAFETY') {
                throw new Error('Response blocked by safety filters');
            }
        }

        // Handle both text and JSON response formats
        let text = '';
        let jsonData: any = null;

        const candidate = data.candidates[0];
        const parts = candidate?.content?.parts || [];

        // Check if response is JSON (when responseMimeType is set)
        for (const part of parts) {
            if (part.text) {
                text = part.text;
            } else if (part.inlineData) {
                // Handle inline data if needed
                text = part.inlineData.data || '';
            }
        }

        // If text looks like JSON, try parsing it directly
        const trimmedText = text.trim();
        if (trimmedText.startsWith('{') && trimmedText.endsWith('}')) {
            try {
                jsonData = JSON.parse(trimmedText);
                console.log('[Gemini] Response is JSON format');
            } catch (e) {
                // Not valid JSON, treat as text
                console.log('[Gemini] Response is text format');
            }
        }

        if (!text || text.trim().length === 0) {
            console.error('[Gemini] Empty response text. Full response:', JSON.stringify(data, null, 2));
            throw new Error('Empty response from Gemini API - this may indicate the File Search Store needs indexing or the query timed out');
        }

        // Extract grounding metadata for citations and file references (BEFORE logging)
        const groundingMetadata = candidate?.groundingMetadata;
        const groundingChunks = groundingMetadata?.groundingChunks || [];
        const webSearchQueries = groundingMetadata?.webSearchQueries || [];

        // Extract file references from grounding chunks
        const fileReferences = new Set<string>();
        const groundingCitations: Array<{
            excerpt: string;
            page?: number;
            source?: string;
            fileUri?: string;
        }> = [];

        for (const chunk of groundingChunks) {
            // Extract file URI if available (multiple possible structures)
            const fileUri = chunk.file?.uri ||
                chunk.file?.name ||
                chunk.fileUri ||
                (typeof chunk.file === 'string' ? chunk.file : null);

            if (fileUri) {
                fileReferences.add(fileUri);
            }

            // Extract chunk text for citation (multiple possible structures)
            const chunkText = chunk.chunk?.chunkText ||
                chunk.chunk?.text ||
                chunk.chunkText ||
                chunk.text ||
                (typeof chunk.chunk === 'string' ? chunk.chunk : '');

            if (chunkText) {
                groundingCitations.push({
                    excerpt: chunkText.substring(0, 500), // Limit excerpt length
                    page: chunk.chunk?.pageNumber || chunk.pageNumber || chunk.page || undefined,
                    source: chunk.file?.displayName || chunk.file?.name || chunk.source || fileUri || undefined,
                    fileUri: fileUri,
                });
            }
        }

        console.log(`[Gemini] ========================================`);
        console.log(`[Gemini] RAG RESPONSE RECEIVED`);
        console.log(`[Gemini] Text length: ${text.length} chars`);
        console.log(`[Gemini] Grounding chunks: ${groundingChunks.length}`);
        console.log(`[Gemini] File references: ${fileReferences.size}`);
        console.log(`[Gemini] Web search queries: ${webSearchQueries.length}`);
        console.log(`[Gemini] Extracted citations: ${groundingCitations.length}`);
        console.log(`[Gemini] ========================================`);

        console.log(`[Gemini] Extracted ${groundingCitations.length} citations from grounding metadata`);
        console.log(`[Gemini] Found ${fileReferences.size} unique file references`);

        // Parse JSON from text response with multiple strategies
        let ragResponse: any = null;

        // If we already parsed JSON from the response, use it
        if (jsonData && typeof jsonData === 'object') {
            ragResponse = jsonData;
            console.log('[Gemini] Using pre-parsed JSON from response');
        } else {
            // Otherwise, try to parse from text
            let jsonText = text.trim();

            // Strategy 1: Try to extract JSON from markdown code blocks
            const jsonBlockMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
            if (jsonBlockMatch) {
                jsonText = jsonBlockMatch[1];
            } else if (jsonText.startsWith('```json')) {
                jsonText = jsonText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
            } else if (jsonText.startsWith('```')) {
                jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }

            // Strategy 2: Try to find JSON object in text
            const jsonObjectMatch = jsonText.match(/\{[\s\S]*\}/);
            if (jsonObjectMatch && !jsonText.trim().startsWith('{')) {
                jsonText = jsonObjectMatch[0];
            }

            // Strategy 3: Try parsing as-is
            try {
                ragResponse = JSON.parse(jsonText);
                console.log('[Gemini] Successfully parsed JSON from text response');
            } catch (e1) {
                console.warn('[Gemini] Strategy 1 failed, trying alternative parsing:', e1);

                // Strategy 4: Try to extract JSON from between first { and last }
                try {
                    const firstBrace = jsonText.indexOf('{');
                    const lastBrace = jsonText.lastIndexOf('}');
                    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                        const extractedJson = jsonText.substring(firstBrace, lastBrace + 1);
                        ragResponse = JSON.parse(extractedJson);
                        console.log('[Gemini] Successfully parsed JSON using brace extraction');
                    } else {
                        throw new Error('No JSON object found');
                    }
                } catch (e2) {
                    console.warn('[Gemini] All JSON parsing strategies failed, using raw text with grounding metadata');
                    // Fallback: Use raw text as answer, but still use grounding metadata for citations
                    ragResponse = {
                        answer: text,
                        citations: [],
                        relevant_reports: [],
                        graphs: [],
                    };
                }
            }
        }

        // Validate and merge response structure
        if (!ragResponse || typeof ragResponse !== 'object') {
            ragResponse = { answer: text, citations: [], relevant_reports: [], graphs: [] };
        }

        // Clean answer text - remove any JSON code blocks that might have been included
        if (ragResponse.answer && typeof ragResponse.answer === 'string') {
            // Remove JSON code blocks from answer text
            ragResponse.answer = ragResponse.answer
                .replace(/```json\s*\{[\s\S]*?\}\s*```/g, '') // Remove ```json { ... } ```
                .replace(/```\s*\{[\s\S]*?\}\s*```/g, '') // Remove ``` { ... } ```
                .replace(/```json[\s\S]*?```/g, '') // Remove any remaining ```json ... ```
                .trim();
        }

        // Ensure answer field exists and is not empty
        if (!ragResponse.answer || typeof ragResponse.answer !== 'string' || ragResponse.answer.trim().length === 0) {
            console.error('[Gemini] Empty answer in parsed response:', JSON.stringify(ragResponse));
            throw new Error('Empty answer in response - this may indicate the File Search Store needs indexing');
        }

        // ALWAYS use grounding metadata citations if available (they're the most reliable)
        // Only merge with prompt citations if grounding citations are missing
        let finalCitations: Array<{
            excerpt: string;
            page?: number;
            source?: string;
            fileUri?: string;
        }> = [];

        if (groundingCitations.length > 0) {
            // Prioritize grounding metadata citations - they're always accurate
            finalCitations = [...groundingCitations];
            console.log(`[Gemini] Using ${groundingCitations.length} citations from grounding metadata`);

            // Merge with any additional citations from the prompt if they don't overlap
            const promptCitations = ragResponse.citations || [];
            if (promptCitations.length > 0) {
                const existingExcerpts = new Set(groundingCitations.map(c => c.excerpt.substring(0, 100)));

                for (const citation of promptCitations) {
                    const excerptStart = (citation.excerpt || '').substring(0, 100);
                    if (!existingExcerpts.has(excerptStart)) {
                        finalCitations.push({
                            excerpt: citation.excerpt || '',
                            page: citation.page,
                            source: citation.source,
                            fileUri: citation.fileUri,
                        });
                    }
                }

                console.log(`[Gemini] Merged ${promptCitations.length} prompt citations, total: ${finalCitations.length}`);
            }
        } else {
            // Fallback to prompt citations if no grounding metadata available
            finalCitations = (ragResponse.citations || []).map((c: any) => ({
                excerpt: c.excerpt || '',
                page: c.page,
                source: c.source,
                fileUri: c.fileUri,
            }));
            console.log(`[Gemini] No grounding metadata, using ${finalCitations.length} citations from prompt`);
        }

        // Ensure we always have citations if grounding metadata exists
        if (groundingCitations.length > 0 && finalCitations.length === 0) {
            console.warn('[Gemini] Grounding citations exist but final citations is empty, using grounding citations');
            finalCitations = [...groundingCitations];
        }

        // Log citation status for debugging
        if (finalCitations.length === 0) {
            console.warn('[Gemini] WARNING: No citations found in response');
            console.warn('[Gemini] Grounding chunks available:', groundingChunks.length);
            console.warn('[Gemini] Prompt citations available:', (ragResponse.citations || []).length);
        } else {
            console.log(`[Gemini] Final citations count: ${finalCitations.length}`);
        }

        // Extract relevant reports from file references
        const relevantReportUris = Array.from(fileReferences);
        if (ragResponse.relevant_reports && Array.isArray(ragResponse.relevant_reports)) {
            // Merge with file references from grounding metadata
            relevantReportUris.push(...ragResponse.relevant_reports.filter((r: any) => typeof r === 'string'));
        }

        return {
            answer: ragResponse.answer.trim(),
            citations: finalCitations,
            relevant_reports: relevantReportUris,
            graphs: ragResponse.graphs || [],
            _groundingMetadata: {
                chunks: groundingChunks.length,
                fileReferences: Array.from(fileReferences),
            },
        };

    } catch (error: any) {
        console.error('[Gemini] ========================================');
        console.error('[Gemini] RAG QUERY ERROR');
        console.error('[Gemini] Query:', query.substring(0, 100));
        console.error('[Gemini] File Search Store:', fileSearchStoreId);
        console.error('[Gemini] Error message:', error.message);
        console.error('[Gemini] Error stack:', error.stack);
        console.error('[Gemini] ========================================');
        throw new Error(`RAG query failed: ${error.message}`);
    }
}

export async function getGeminiFileInfo(storeId: string, documentId: string): Promise<any> {
    try {
        const documentName = `${storeId}/documents/${documentId}`;
        return await ai.fileSearchStores.documents.get({ name: documentName });
    } catch (e: any) {
        console.error('[Gemini] Get document error:', e);
        throw e;
    }
}

export async function deleteGeminiFile(storeId: string, documentId: string): Promise<void> {
    try {
        const documentName = `${storeId}/documents/${documentId}`;
        await ai.fileSearchStores.documents.delete({ name: documentName });
        console.log(`[Gemini] Deleted document: ${documentName}`);
    } catch (e: any) {
        console.error('[Gemini] Delete document error:', e);
    }
}

/**
 * Generate evidence-first answer from reranked chunks
 * This is the enhanced answer generator that produces structured, evidence-grounded responses
 */
export async function generateEvidenceFirstAnswer(
    question: string,
    chunks: RankedChunk[],
    requiredSections: string[],
    fileSearchStoreId: string
): Promise<EnhancedRAGResponse> {
    try {
        console.log(`[Gemini] ========================================`);
        console.log(`[Gemini] EVIDENCE-FIRST ANSWER GENERATION`);
        console.log(`[Gemini] Question: "${question}"`);
        console.log(`[Gemini] Chunks: ${chunks.length}`);
        console.log(`[Gemini] Required sections: ${requiredSections.join(', ')}`);
        console.log(`[Gemini] ========================================`);

        if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');

        if (!chunks || chunks.length === 0) {
            throw new Error('No chunks provided for answer generation');
        }

        // Format context from chunks
        const formattedContext = formatContextForAnswer(chunks);

        const prompt = `You are a financial research analyst. Answer the user's question using ONLY the provided context from research reports.

USER QUESTION:
${question}

RETRIEVED CONTEXT (Top ${chunks.length} most relevant chunks):
${formattedContext}

INSTRUCTIONS:
1. **Direct Answer First**: Start with a direct, specific answer to the question (2-3 sentences).
2. **Detailed Breakdown**: Provide comprehensive details organized by:
   - Key findings/numbers (with exact values from context)
   - Implementation details (how, when, who)
   - Risks and assumptions
   - Supporting evidence (quotes from context)
3. **Evidence Grounding**: 
   - Every claim MUST be supported by a quote from the context
   - Include inline citation markers [1], [2], [3] after each claim
   - If information is missing, explicitly state "Not found in provided reports" and list what would be needed
4. **Structure**: Use markdown with headers, bullet points, and tables for clarity
5. **Finance-Specific**: 
   - Include exact numbers, percentages, timeframes
   - Reference specific regulations, companies, sectors
   - Distinguish between forecasts vs. historical data

REQUIRED SECTIONS: ${requiredSections.join(', ')}

OUTPUT JSON SCHEMA:
{
  "answer": "string (markdown formatted answer with inline citations [1], [2], etc. - for backward compatibility)",
  "enhanced_answer": {
    "direct_answer": "string (2-3 sentences directly answering question)",
    "detailed_breakdown": [
      {
        "heading": "string",
        "details": "string (markdown formatted)",
        "supporting_points": ["string"],
        "citations": [1, 2, 3]
      }
    ],
    "numbers": [
      {
        "metric": "string",
        "value": "string",
        "context": "string",
        "source_ref": "string (chunk ID or doc name)"
      }
    ],
    "assumptions": ["string"],
    "risks": ["string"],
    "missing_info": ["string (what couldn't be found)"]
  },
  "citations": [
    {
      "id": 1,
      "doc": "string",
      "ref": "string (page/section)",
      "excerpt": "string (exact quote, <=50 words)",
      "relevance": "string"
    }
  ],
  "evidence": [
    {
      "doc": "string",
      "ref": "string",
      "quote": "string (<=25 words, exact quote)"
    }
  ],
  "missing_info": ["string"]
}

CRITICAL CONSTRAINTS:
- Answer ONLY from provided context. If context doesn't contain information, say so explicitly.
- Do NOT add generic knowledge or assumptions not in context.
- Every number, percentage, and claim must have a citation.
- Use exact quotes from context when possible.
- If the question asks for something not in context, list what's missing in "missing_info".
- The "answer" field should be a comprehensive markdown-formatted text (for backward compatibility).
- The "enhanced_answer" field contains the structured breakdown.

Return ONLY valid JSON, no markdown code blocks.`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: prompt }],
                    },
                ],
                tools: [
                    {
                        file_search: {
                            file_search_store_names: [fileSearchStoreId],
                        },
                    },
                ],
                generationConfig: {
                    temperature: 0.1,
                    topK: 20,
                    topP: 0.8,
                    maxOutputTokens: 8192,
                    responseMimeType: 'application/json',
                },
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Evidence-first answer generation failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(`Evidence-first answer API error: ${data.error.message || JSON.stringify(data.error)}`);
        }

        if (!data.candidates || data.candidates.length === 0) {
            throw new Error('No response candidates from evidence-first answer generation');
        }

        const text = data.candidates[0]?.content?.parts?.[0]?.text || '';
        if (!text || text.trim().length === 0) {
            throw new Error('Empty response from evidence-first answer generation');
        }

        // Parse JSON response
        let jsonText = text.trim();
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
        } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        let enhancedResponse: EnhancedRAGResponse;
        try {
            enhancedResponse = JSON.parse(jsonText);
        } catch (e) {
            console.error('[Gemini] Failed to parse enhanced response:', e);
            throw new Error('Invalid JSON response from evidence-first answer generation');
        }

        // Validate structure
        if (!enhancedResponse.answer || typeof enhancedResponse.answer !== 'string') {
            throw new Error('Invalid response structure: missing or invalid answer field');
        }

        // Ensure arrays exist
        if (!Array.isArray(enhancedResponse.citations)) {
            enhancedResponse.citations = [];
        }
        if (!Array.isArray(enhancedResponse.evidence)) {
            enhancedResponse.evidence = [];
        }
        if (!Array.isArray(enhancedResponse.missing_info)) {
            enhancedResponse.missing_info = [];
        }

        console.log(`[Gemini] Evidence-first answer generated: answer length=${enhancedResponse.answer.length}, citations=${enhancedResponse.citations.length}, evidence=${enhancedResponse.evidence.length}`);

        return enhancedResponse;
    } catch (error: any) {
        console.error('[Gemini] Evidence-first answer error:', error);
        throw new Error(`Evidence-first answer generation failed: ${error.message}`);
    }
}
