// Query Rewrite Module
// Rewrites user questions into structured query plans optimized for financial research reports

import type { QueryRewrite, ChatTurn } from './types.ts';

const MAX_SUBQUERIES = 3;

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';
const GEMINI_MODEL = 'gemini-3.1-flash-lite'; // Fast model for query rewriting

/**
 * Rewrite a user question into a structured query plan
 */
export async function rewriteQuery(
  question: string,
  filters?: {
    sector?: string;
    tickers?: string[];
    date_from?: string;
    date_to?: string;
  },
  history: ChatTurn[] = []
): Promise<QueryRewrite> {
  try {
    console.log(`[Query Rewrite] Rewriting query: "${question}"`);

    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    // Build context from filters
    let contextString = '';
    if (filters?.sector) {
      contextString += `Focus on sector: ${filters.sector}. `;
    }
    if (filters?.tickers && filters.tickers.length > 0) {
      contextString += `Focus on tickers: ${filters.tickers.join(', ')}. `;
    }
    if (filters?.date_from || filters?.date_to) {
      const from = filters.date_from || 'earliest';
      const to = filters.date_to || 'latest';
      contextString += `Time range: ${from} to ${to}. `;
    }

    const historyBlock = history.length > 0
      ? `CONVERSATION SO FAR (oldest first):
${history.map((t) => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.content}`).join('\n')}

The user's latest message may be a follow-up that relies on this conversation ("and its margins?", "why?", "compare with the other one"). Resolve pronouns and omissions using the conversation so the question stands alone.

`
      : '';

    const prompt = `${contextString}
${historyBlock}You are a financial research query analyzer. Rewrite the user's question into a structured query plan optimized for retrieving information from financial research reports.

USER QUESTION: ${history.length > 0 ? 'LATEST MESSAGE: ' : ''}${question}

CONTEXT: Financial research reports contain:
- Regulatory changes (GST, BEE norms, policy updates, compliance requirements)
- Financial metrics (revenue, EBITDA, margins, growth rates, EPS, cash flow)
- Company ratings and price targets
- Sector outlooks and key drivers
- Risk factors and catalysts
- Tables with numerical data
- Forecasts and guidance
- Segment analysis

TASK: Generate a structured query plan that will:
1. Extract key entities (companies, sectors, regulations, metrics, timeframes)
2. Identify synonyms and related terms used in finance reports
3. Break the question into exactly 3 focused, non-overlapping subqueries for multi-query retrieval
4. Write standalone_question: the question rewritten so it is fully self-contained and makes sense without the conversation (identical to the user's question if it already is)
5. Specify required output sections based on question intent

OUTPUT JSON SCHEMA:
{
  "intent": "string (one word: regulatory_changes|financial_metrics|risk_analysis|company_comparison|sector_outlook|forecast_analysis)",
  "standalone_question": "string (self-contained version of the user's question)",
  "entities": ["string"],
  "constraints": {
    "time_range": {"from": "YYYY-MM", "to": "YYYY-MM"},
    "sectors": ["string"],
    "tickers": ["string"],
    "must_include_numbers": boolean,
    "must_include_forecasts": boolean
  },
  "synonyms": ["string"],
  "subqueries": [
    "string (focused query for retrieval)"
  ],
  "required_sections": ["string"],
  "expected_output": "detailed_breakdown|comparison_table|step_by_step|bullets"
}

FINANCE-SPECIFIC TERMS TO INCLUDE:
- Regulatory: "GST", "BEE norms", "compliance", "regulatory change", "policy update", "Bureau of Energy Efficiency"
- Financial: "revenue", "EBITDA", "margin", "growth", "forecast", "guidance", "target price", "EPS", "cash flow"
- Structure: "table", "chart", "page", "section", "note", "risk factors", "catalysts", "segment"
- Time: "quarterly", "annual", "FY", "Q1", "Q2", etc.

EXAMPLES:

Question: "What are the regulatory changes affecting consumer durables?"
{
  "intent": "regulatory_changes",
  "standalone_question": "What are the regulatory changes affecting consumer durables?",
  "entities": ["regulatory changes", "consumer durables"],
  "constraints": {"sectors": ["Consumer Discretionary"]},
  "synonyms": ["regulations", "policy", "compliance", "BEE", "GST"],
  "subqueries": [
    "regulatory changes consumer durables sector",
    "BEE norms consumer durables implementation and price impact",
    "GST rate changes and compliance requirements consumer durables"
  ],
  "required_sections": ["Direct Answer", "Regulatory Changes", "Implementation Details", "Price Impact", "Timeline"],
  "expected_output": "detailed_breakdown"
}

Return ONLY valid JSON, no markdown code blocks, no explanatory text.`;

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
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Query rewrite failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`Query rewrite API error: ${data.error.message || JSON.stringify(data.error)}`);
    }

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('No response candidates from query rewrite');
    }

    const text = data.candidates[0]?.content?.parts?.[0]?.text || '';
    if (!text || text.trim().length === 0) {
      throw new Error('Empty response from query rewrite');
    }

    // Parse JSON response
    let jsonText = text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const queryObject: QueryRewrite = JSON.parse(jsonText);

    // Validate structure
    if (!queryObject.intent || !queryObject.subqueries || queryObject.subqueries.length === 0) {
      throw new Error('Invalid query rewrite structure');
    }

    queryObject.subqueries = queryObject.subqueries.slice(0, MAX_SUBQUERIES);
    if (!queryObject.standalone_question || typeof queryObject.standalone_question !== 'string') {
      queryObject.standalone_question = question;
    }

    console.log(`[Query Rewrite] Success: intent=${queryObject.intent}, subqueries=${queryObject.subqueries.length}`);

    return queryObject;
  } catch (error: any) {
    console.error('[Query Rewrite] Error:', error);
    throw new Error(`Query rewrite failed: ${error.message}`);
  }
}

