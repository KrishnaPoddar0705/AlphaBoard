// Reranking Module
// Reranks top candidates using a fast model to select the most relevant chunks

import type { RetrievedChunk, RankedChunk } from './types.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';
const GEMINI_MODEL = 'gemini-2.0-flash-exp'; // Fast model for reranking

/**
 * Rerank chunks by relevance to the question
 */
export async function rerankChunks(
  question: string,
  candidates: RetrievedChunk[],
  topK: number = 10
): Promise<RankedChunk[]> {
  try {
    console.log(`[Rerank] Reranking ${candidates.length} candidates, keeping top ${topK}`);

    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    if (!candidates || candidates.length === 0) {
      return [];
    }

    // Limit to top 50 for reranking (cost/performance tradeoff)
    const candidatesToRerank = candidates.slice(0, 50);
    
    if (candidatesToRerank.length === 0) {
      return [];
    }

    // Build prompt with candidates
    const candidatesText = candidatesToRerank.map((c, i) => `
[${i}]
Document: ${c.documentTitle || c.documentId || 'Unknown'}
${c.pageNumber ? `Page: ${c.pageNumber}` : ''}
Text: ${c.text.substring(0, 300)}${c.text.length > 300 ? '...' : ''}
`).join('\n');

    const prompt = `You are a financial research retrieval expert. Score each candidate chunk by how directly it answers the user's question.

USER QUESTION: ${question}

CANDIDATES:
${candidatesText}

SCORING RUBRIC (0-10 total):
- Directly answers the question? (0-4 points)
- Has implementation details/numbers? (0-3 points)
- Has relevant context (companies, sectors, regulations)? (0-2 points)
- Is from a relevant section (not appendix/cover)? (0-1 point)

Return JSON array with scores:
[
  {"id": 0, "score": 8.5, "rationale": "Directly mentions BEE norms and price impact with specific numbers"},
  {"id": 1, "score": 6.0, "rationale": "Related but lacks specific numbers"},
  ...
]

Return ONLY valid JSON array, no markdown code blocks, no explanatory text.`;

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
        generationConfig: {
          temperature: 0.1,
          topK: 20,
          topP: 0.8,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[Rerank] Reranking failed: ${response.status} - ${errorText}`);
      // Fallback: return top candidates by relevance score
      return candidatesToRerank.slice(0, topK).map(c => ({
        ...c,
        rerankScore: c.relevanceScore,
        rerankRationale: 'Fallback: using heuristic score',
      }));
    }

    const data = await response.json();

    if (data.error || !data.candidates || data.candidates.length === 0) {
      console.warn('[Rerank] Reranking API error, using fallback');
      return candidatesToRerank.slice(0, topK).map(c => ({
        ...c,
        rerankScore: c.relevanceScore,
        rerankRationale: 'Fallback: using heuristic score',
      }));
    }

    const text = data.candidates[0]?.content?.parts?.[0]?.text || '';
    if (!text || text.trim().length === 0) {
      console.warn('[Rerank] Empty reranking response, using fallback');
      return candidatesToRerank.slice(0, topK).map(c => ({
        ...c,
        rerankScore: c.relevanceScore,
        rerankRationale: 'Fallback: using heuristic score',
      }));
    }

    // Parse JSON response
    let jsonText = text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    let rankings: Array<{ id: number; score: number; rationale?: string }>;
    try {
      rankings = JSON.parse(jsonText);
    } catch (e) {
      console.warn('[Rerank] Failed to parse rankings, using fallback');
      return candidatesToRerank.slice(0, topK).map(c => ({
        ...c,
        rerankScore: c.relevanceScore,
        rerankRationale: 'Fallback: using heuristic score',
      }));
    }

    // Merge scores back into candidates
    const ranked: RankedChunk[] = candidatesToRerank.map((candidate, i) => {
      const ranking = rankings.find((r: any) => r.id === i);
      return {
        ...candidate,
        rerankScore: ranking?.score || candidate.relevanceScore,
        rerankRationale: ranking?.rationale || 'No rationale provided',
      };
    }).sort((a, b) => b.rerankScore - a.rerankScore);

    const topRanked = ranked.slice(0, topK);
    console.log(`[Rerank] Top reranked chunk score: ${topRanked[0]?.rerankScore || 0}`);

    return topRanked;
  } catch (error: any) {
    console.error('[Rerank] Error:', error);
    // Fallback: return top candidates by relevance score
    return candidates.slice(0, topK).map(c => ({
      ...c,
      rerankScore: c.relevanceScore,
      rerankRationale: `Fallback: ${error.message}`,
    }));
  }
}

