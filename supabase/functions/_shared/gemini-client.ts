// Shared Gemini Client
// Purpose: Handle file uploads, parsing, and RAG queries using Google Gemini File Search API
// Using NEW SDK: @google/genai (not @google/generative-ai)

// @ts-ignore - Deno npm imports don't have built-in type declarations
import { GoogleGenAI } from 'npm:@google/genai@1.29.0';

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

export interface RAGResponse {
    answer: string;
    citations: Array<{
        report_id?: string;
        title?: string;
        page?: number;
        excerpt: string;
        source?: string;
    }>;
    relevant_reports: string[];
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
        console.log(`[Gemini] RAG Query: "${query}"`);
        console.log(`[Gemini] File Search Store: ${fileSearchStoreId}`);

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
Please provide a comprehensive answer based on the research reports.
Include specific citations with page numbers.
Format as JSON: { "answer": "...", "citations": [{excerpt, page, source}], "relevant_reports": [] }`;

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
            ]
        };

        console.log(`[Gemini] Calling REST API (v1beta) for RAG query...`);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Gemini] RAG API error:', response.status, errorText);
            throw new Error(`Gemini RAG error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        console.log(`[Gemini] RAG Response received (${text.length} chars)`);

        // Parse JSON
        let jsonText = text.trim();
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
        } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '');
        }

        let ragResponse;
        try {
            ragResponse = JSON.parse(jsonText);
        } catch (e) {
            ragResponse = { answer: text, citations: [], relevant_reports: [] };
        }

        return {
            answer: ragResponse.answer || text,
            citations: ragResponse.citations || [],
            relevant_reports: ragResponse.relevant_reports || [],
        };

    } catch (error: any) {
        console.error('[Gemini] RAG error:', error);
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
