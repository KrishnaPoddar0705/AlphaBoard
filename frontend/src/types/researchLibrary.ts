export interface LibraryReport {
  id: string;
  title: string;
  sector?: string | null;
  tickers?: string[] | null;
  created_at: string;
  original_filename: string;
  upload_status: string;
  analyst?: { username: string };
}

export interface ParsedReport {
  title?: string;
  sector_outlook?: string;
  key_drivers?: string[];
  company_ratings?: Array<{ company: string; rating: string; rationale: string }>;
  valuation_summary?: string;
  risks?: string[];
  catalysts?: string[];
  price_forecasts?: Array<{ asset: string; forecast: string; timeframe: string }>;
  regulatory_changes?: string[];
  financial_tables?: Array<{ description: string; page: number; data: unknown }>;
  summary_sentence?: string;
  one_paragraph_thesis?: string;
  three_key_insights?: string[];
  three_risks?: string[];
  three_catalysts?: string[];
  three_actionables?: string[];
  citations?: Array<{ text: string; page: number; source?: string }>;
}

export interface ReportDetailData extends LibraryReport {
  analyst_id?: string;
  storage_path?: string;
  parsed?: ParsedReport;
  pdfUrl: string;
}

/** How the left panel files reports into folders. */
export type FolderMode = 'sector' | 'broker' | 'month';
