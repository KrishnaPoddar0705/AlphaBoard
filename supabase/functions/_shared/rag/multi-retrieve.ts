// Multi-Query Retrieval Module
// Executes multiple subqueries in parallel and merges results with section-aware scoring

import type { RetrievedChunk } from './types.ts';
import { extractGroundingChunks, dedupeChunks, applyHeuristicBoosts } from './utils.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';
const GEMINI_MODEL = 'gemini-flash-latest';

/**
 * Execute multiple subqueries in parallel and retrieve chunks
 */
export async function multiQueryRetrieve(
  subqueries: string[],
  fileSearchStoreId: string,
  orgId: string
): Promise<RetrievedChunk[]> {
  try {
    console.log(`[Multi-Retrieve] Executing ${subqueries.length} subqueries in parallel`);

    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    if (!subqueries || subqueries.length === 0) {
      throw new Error('No subqueries provided');
    }

    // Execute all subqueries in parallel
    const retrievalPromises = subqueries.map(async (subquery, index) => {
      try {
        console.log(`[Multi-Retrieve] Subquery ${index + 1}/${subqueries.length}: "${subquery.substring(0, 100)}"`);

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: subquery }],
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
              maxOutputTokens: 512, // Just for retrieval, not full answer
            },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`[Multi-Retrieve] Subquery ${index + 1} failed: ${response.status} - ${errorText}`);
          return [];
        }

        const data = await response.json();

        if (data.error) {
          console.warn(`[Multi-Retrieve] Subquery ${index + 1} API error:`, data.error);
          return [];
        }

        // Extract grounding chunks
        const chunks = extractGroundingChunks(data);
        
        // Tag each chunk with its source query
        return chunks.map(chunk => ({
          ...chunk,
          sourceQuery: subquery,
        }));
      } catch (error: any) {
        console.warn(`[Multi-Retrieve] Subquery ${index + 1} error:`, error.message);
        return [];
      }
    });

    // Wait for all subqueries to complete
    const results = await Promise.all(retrievalPromises);

    // Flatten all chunks
    const allChunks = results.flat();
    console.log(`[Multi-Retrieve] Retrieved ${allChunks.length} total chunks from ${subqueries.length} subqueries`);

    // Deduplicate chunks
    const deduped = dedupeChunks(allChunks);
    console.log(`[Multi-Retrieve] After deduplication: ${deduped.length} unique chunks`);

    // Apply section-aware heuristic boosts
    const boosted = applyHeuristicBoosts(deduped);
    console.log(`[Multi-Retrieve] Top chunk score: ${boosted[0]?.relevanceScore || 0}`);

    return boosted;
  } catch (error: any) {
    console.error('[Multi-Retrieve] Error:', error);
    throw new Error(`Multi-query retrieval failed: ${error.message}`);
  }
}

