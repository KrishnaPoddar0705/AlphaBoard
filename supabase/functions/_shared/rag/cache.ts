// Cache Module
// Handles question normalization, hashing, and cache operations

/**
 * Normalize a question for consistent hashing
 */
export function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/[^\w\s]/g, '') // Remove punctuation (optional, can be adjusted)
    .trim();
}

/**
 * Create SHA-256 hash of text using Web Crypto API
 */
export async function sha256Hash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Check cache for existing answer
 */
export async function checkCache(
  orgId: string,
  questionHash: string,
  supabaseClient: any
): Promise<Response | null> {
  try {
    const { data, error } = await supabaseClient
      .from('rag_query_cache')
      .select('answer_json')
      .eq('org_id', orgId)
      .eq('question_hash', questionHash)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.warn('[Cache] Error checking cache:', error);
      return null;
    }

    if (data && data.answer_json) {
      console.log('[Cache] Cache hit for question hash:', questionHash.substring(0, 16));
      return new Response(JSON.stringify(data.answer_json), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Cache': 'HIT',
        },
      });
    }

    return null;
  } catch (error: any) {
    console.warn('[Cache] Error checking cache:', error.message);
    return null;
  }
}

/**
 * Cache an answer
 */
export async function cacheAnswer(
  orgId: string,
  questionHash: string,
  answer: any,
  supabaseClient: any,
  ttlMinutes: number = 10
): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

    const { error } = await supabaseClient
      .from('rag_query_cache')
      .upsert({
        org_id: orgId,
        question_hash: questionHash,
        answer_json: answer,
        expires_at: expiresAt,
      }, {
        onConflict: 'org_id,question_hash',
      });

    if (error) {
      console.warn('[Cache] Error caching answer:', error);
      // Non-critical, don't throw
    } else {
      console.log('[Cache] Cached answer for question hash:', questionHash.substring(0, 16));
    }
  } catch (error: any) {
    console.warn('[Cache] Error caching answer:', error.message);
    // Non-critical, don't throw
  }
}

