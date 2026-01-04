// Utility functions for Enhanced RAG System

import type { RetrievedChunk, RankedChunk } from './types.ts';

/**
 * Create a unique hash for a chunk based on document ID and text
 */
export function createChunkHash(documentId: string, text: string): string {
  const normalized = `${documentId}:${text.trim().toLowerCase()}`;
  // Simple hash function (for deduplication, not cryptographic)
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Deduplicate chunks by document ID and chunk text hash
 */
export function dedupeChunks(chunks: RetrievedChunk[]): RetrievedChunk[] {
  const seen = new Map<string, RetrievedChunk>();
  
  for (const chunk of chunks) {
    const hash = chunk.chunkHash || createChunkHash(
      chunk.documentId || chunk.documentUri || 'unknown',
      chunk.text
    );
    
    if (!seen.has(hash)) {
      seen.set(hash, { ...chunk, chunkHash: hash });
    } else {
      // If we've seen this chunk, keep the one with higher relevance score
      const existing = seen.get(hash)!;
      if (chunk.relevanceScore > existing.relevanceScore) {
        seen.set(hash, { ...chunk, chunkHash: hash });
      }
    }
  }
  
  return Array.from(seen.values());
}

/**
 * Format chunks for answer generation prompt
 */
export function formatContextForAnswer(chunks: RankedChunk[]): string {
  return chunks.map((chunk, index) => {
    const docInfo = chunk.documentTitle || chunk.documentId || 'Unknown Document';
    const pageInfo = chunk.pageNumber ? ` (Page ${chunk.pageNumber})` : '';
    return `[Chunk ${index + 1}]
Document: ${docInfo}${pageInfo}
Text: ${chunk.text.substring(0, 500)}${chunk.text.length > 500 ? '...' : ''}
Relevance Score: ${chunk.rerankScore.toFixed(1)}/10
`;
  }).join('\n\n');
}

/**
 * Extract grounding chunks from Gemini API response
 */
export function extractGroundingChunks(response: any): RetrievedChunk[] {
  const chunks: RetrievedChunk[] = [];
  
  const candidate = response.candidates?.[0];
  if (!candidate) return chunks;
  
  const groundingMetadata = candidate.groundingMetadata;
  const groundingChunks = groundingMetadata?.groundingChunks || [];
  
  for (const chunk of groundingChunks) {
    // Extract file/document info
    const fileUri = chunk.file?.uri || 
                   chunk.file?.name || 
                   chunk.fileUri ||
                   (typeof chunk.file === 'string' ? chunk.file : null);
    
    const documentId = fileUri ? fileUri.split('/').pop() : undefined;
    const documentTitle = chunk.file?.displayName || chunk.file?.name || documentId;
    
    // Extract chunk text
    const chunkText = chunk.chunk?.chunkText || 
                    chunk.chunk?.text || 
                    chunk.chunkText ||
                    chunk.text ||
                    (typeof chunk.chunk === 'string' ? chunk.chunk : '');
    
    if (chunkText) {
      chunks.push({
        text: chunkText,
        documentId: documentId,
        documentTitle: documentTitle,
        documentUri: fileUri,
        pageNumber: chunk.chunk?.pageNumber || chunk.pageNumber || chunk.page,
        chunkIndex: chunk.chunk?.chunkIndex,
        sourceQuery: '', // Will be set by caller
        relevanceScore: 1.0, // Initial score, will be boosted
        chunkHash: createChunkHash(documentId || fileUri || 'unknown', chunkText),
      });
    }
  }
  
  return chunks;
}

/**
 * Apply section-aware heuristic boosts to chunks
 */
export function applyHeuristicBoosts(chunks: RetrievedChunk[]): RetrievedChunk[] {
  return chunks.map(chunk => {
    let score = chunk.relevanceScore;
    
    // +2 if contains numbers/percentages/currency
    if (/\d+%|\$\d+|Rs\s*\d+|₹\d+|\d+\.\d+/.test(chunk.text)) {
      score += 2;
    }
    
    // +2 if looks like table row (pipe-separated or tab-separated)
    if (/\|.*\|/.test(chunk.text) || chunk.text.split('\t').length > 3) {
      score += 2;
    }
    
    // +1 if matches finance section headers
    const financeHeaders = /(risk|outlook|guidance|revenue|ebitda|margin|forecast|target|rating|segment|regulatory|compliance|bee|gst)/i;
    if (financeHeaders.test(chunk.text)) {
      score += 1;
    }
    
    return {
      ...chunk,
      relevanceScore: score,
    };
  }).sort((a, b) => b.relevanceScore - a.relevanceScore);
}

