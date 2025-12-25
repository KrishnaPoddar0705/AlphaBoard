/**
 * Thesis Types
 * 
 * Type definitions for AI-generated investment thesis
 */

export interface Thesis {
  ticker: string;
  generated_at: string;
  summary: string;
  bullCase: string;
  bearCase: string;
  baseCase: string;
  risks: string[];
  catalysts: string[];
  rating: 'Buy' | 'Hold' | 'Sell';
  ratingJustification: string;
}

export interface ThesisGenerateRequest {
  ticker: string;
  analyst_notes?: string;
}

export interface ThesisCacheEntry {
  ticker: string;
  thesis: Thesis;
  timestamp: number;
  regenerated_count: number;
}

export type ExportFormat = 'pdf' | 'notion';

export interface ExportOptions {
  format: ExportFormat;
  title?: string;
}
