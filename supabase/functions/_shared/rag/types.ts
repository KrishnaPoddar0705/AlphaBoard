// Type definitions for Enhanced RAG System

export interface QueryRewrite {
  intent: string; // e.g., "regulatory_changes", "financial_metrics", "risk_analysis", "company_comparison", "sector_outlook"
  entities: string[]; // ["BEE norms", "GST", "RAC", "consumer durables"]
  constraints: {
    time_range?: { from?: string; to?: string };
    sectors?: string[];
    tickers?: string[];
    must_include_numbers?: boolean;
    must_include_forecasts?: boolean;
  };
  synonyms: string[]; // ["BEE", "Bureau of Energy Efficiency", "energy efficiency norms"]
  subqueries: string[]; // 4-8 focused queries
  required_sections: string[]; // ["Direct Answer", "Detailed Breakdown", "Numbers & Calculations", "Risks", "Implementation Details"]
  expected_output: string; // "detailed_breakdown" | "comparison_table" | "step_by_step" | "bullets"
}

export interface RetrievedChunk {
  text: string;
  documentId?: string;
  documentTitle?: string;
  documentUri?: string;
  pageNumber?: number;
  chunkIndex?: number;
  sourceQuery: string; // Which subquery retrieved this chunk
  relevanceScore: number; // Heuristic score after section-aware boosting
  chunkHash?: string; // For deduplication
}

export interface RankedChunk extends RetrievedChunk {
  rerankScore: number; // Score from reranking model (0-10)
  rerankRationale?: string; // Why this chunk scored this way
}

export interface EnhancedAnswer {
  direct_answer: string; // 2-3 sentence direct answer
  detailed_breakdown: Array<{
    heading: string;
    details: string; // Markdown formatted
    supporting_points: string[];
    citations: number[]; // Citation IDs referenced in this section
  }>;
  numbers: Array<{
    metric: string;
    value: string;
    context: string;
    source_ref: string; // Chunk ID or document reference
  }>;
  assumptions: string[];
  risks: string[];
  missing_info: string[];
}

export interface Evidence {
  doc: string; // Document name/title
  ref: string; // Page/section reference
  quote: string; // Exact quote (<=25 words)
}

export interface EnhancedCitation {
  id: number; // Citation ID (1-based for inline references)
  doc: string;
  ref: string; // Page/section
  excerpt: string; // Exact quote (<=50 words)
  relevance: string; // Why this citation is relevant
  report_id?: string; // AlphaBoard report ID (after enhancement)
  title?: string; // Report title (after enhancement)
  fileUri?: string; // Gemini file URI
}

export interface EnhancedRAGResponse {
  // Legacy fields (for backward compatibility)
  answer: string; // Markdown formatted answer
  citations: Array<{
    excerpt: string;
    page?: number;
    source?: string;
    report_id?: string;
    title?: string;
    fileUri?: string;
  }>;
  relevant_reports: string[] | Array<{
    id: string;
    title: string;
    sector?: string;
    tickers?: string[];
    created_at?: string;
  }>;
  graphs?: Array<{
    type: 'line' | 'bar' | 'pie' | 'area';
    title: string;
    xAxis?: string;
    yAxis?: string;
    data: Array<{ [key: string]: string | number }>;
    series?: Array<{ name: string; data: number[] }>;
  }>;
  
  // New enhanced fields
  enhanced_answer?: EnhancedAnswer;
  evidence?: Evidence[];
  missing_info?: string[];
  
  // Metadata
  query_time_ms?: number;
  total_reports_searched?: number;
  retrieval_debug?: {
    subqueries: string[];
    retrieved_count: number;
    reranked_count: number;
  };
}

