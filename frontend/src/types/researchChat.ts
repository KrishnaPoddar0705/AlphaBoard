export interface ChatCitation {
  excerpt: string;
  page?: number;
  source?: string;
  report_id?: string;
  title?: string;
  /** The report's own wording around the quote, when it could be placed in the page text. */
  passage?: string;
  /** [start, end) of the quoted words inside `passage`. */
  passage_hit?: [number, number];
}

export interface ChatReport {
  id: string;
  title: string;
  sector?: string;
  tickers?: string[];
  created_at?: string;
}

export interface ChatGraph {
  type: 'line' | 'bar' | 'pie' | 'area';
  title: string;
  xAxis?: string;
  yAxis?: string;
  data?: Array<{ [key: string]: string | number }>;
  series?: Array<{ name: string; data: number[] }>;
}

/** The assistant's structured answer, as saved in research_messages.response. */
export interface ChatAnswer {
  answer: string;
  citations: ChatCitation[];
  relevant_reports: ChatReport[];
  graphs?: ChatGraph[];
  missing_info?: string[];
  query_time_ms?: number;
}

export interface ResearchConversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ResearchMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  response: ChatAnswer | null;
  scope_report_ids: string[] | null;
  created_at: string;
}

/** What the edge function returns: the answer plus where it was saved. */
export interface SendMessageResult extends ChatAnswer {
  conversation_id: string | null;
  message_id: string | null;
  title: string | null;
  pipeline_failed?: boolean;
  error?: string;
}

/** Router state `/research/chat` reads to send a question as soon as it opens. */
export interface ChatLocationState {
  question?: string;
  /** Reports to limit the question to (the library's active filters). */
  reports?: Array<Pick<ChatReport, 'id' | 'title'>>;
}
