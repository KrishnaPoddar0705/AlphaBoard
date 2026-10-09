/**
 * Command Center domain types.
 *
 * These mirror `database/migration_add_command_center.sql` one-for-one. When a CHECK
 * constraint there changes, the matching union here has to change with it -- the
 * database is the authority, not this file.
 */

export type UnderstandingLevel = 'high' | 'medium' | 'low'
export type ModelStatus = 'none' | 'basic' | 'detailed'

/**
 * The discriminator on `cc_events`. Every interaction category the desk tracks is a
 * row in one table, distinguished by this: that is what lets the timeline, the calendar
 * and the org activity feed each be a single query.
 */
export type EventKind =
  | 'management_meeting'
  | 'concall'
  | 'annual_report'
  | 'broker_report'
  | 'agm'
  | 'other'

/** Only ever set when `kind === 'management_meeting'` (enforced by a CHECK). */
export type EventSubtype =
  | '1:1'
  | 'plant_visit'
  | 'conference'
  | 'group_meeting'
  | 'call'
  | 'site_visit'

/** Concall: did we attend? Annual report: have we read it? */
export type Attendance = 'yes' | 'no' | 'na'

export type ThesisImpact = 'positive' | 'negative' | 'neutral'
/** The Svan View meter, from most bearish to most bullish. */
export type SvanRating = 'strong_sell' | 'sell' | 'neutral' | 'buy' | 'strong_buy'

export type ContactDesignation =
  | 'IR' | 'CSO' | 'CFO' | 'MD' | 'CEO' | 'COO' | 'Chairman' | 'Other'

export interface Broker {
  id: string
  organization_id: string | null
  created_by: string | null
  name: string
  is_active: boolean
  created_at: string
}

export interface Coverage {
  id: string
  organization_id: string | null
  created_by: string
  ticker: string
  company_name: string | null
  market: string | null
  understanding_level: UnderstandingLevel | null
  model_status: ModelStatus
  corporate_address: string | null
  sector: string | null
  lead_analyst_id: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * A row of `cc_coverage_board` -- the coverage row plus the aggregates the board shows.
 * Flat, because it maps a view one-for-one; do not nest these without changing the SQL.
 */
export interface CoverageBoardRow extends Coverage {
  lead_analyst_username: string | null
  /** Most recent logged (non-scheduled, non-future) event date; null when untouched. */
  last_interaction_on: string | null
  /** Whole days since `last_interaction_on`; null when nothing is logged yet. */
  days_since_interaction: number | null
  /** Logged events only -- scheduled ones are not work that has happened. */
  event_count: number
  broker_report_count: number
  latest_concall_period: string | null
  latest_concall_attendance: Attendance | null
  latest_annual_report_period: string | null
  latest_annual_report_attendance: Attendance | null
  next_scheduled_title: string | null
  next_scheduled_on: string | null
  contact_count: number
  /**
   * Latest held meeting / concall / AGM -- the desk talking to the company itself.
   * Undefined until database/migration_command_center_home.sql is applied.
   */
  last_primary_research_on?: string | null
  /** Whose work the latest logged entry is. Added by migration_command_center_board_last_analyst.sql. */
  last_entry_by?: string | null
  last_entry_by_username?: string | null
}

export interface CommandCenterEvent {
  id: string
  coverage_id: string
  organization_id: string | null
  kind: EventKind
  subtype: EventSubtype | null
  title: string
  event_date: string
  is_scheduled: boolean
  attendance: Attendance
  period_label: string | null
  broker_id: string | null
  kta: string | null
  thesis_impact: ThesisImpact | null
  open_questions: string | null
  analyst_id: string | null
  created_by: string
  created_at: string
  updated_at: string
  /** See ActivityFeedRow: escalation targets, and the flag derived from them. */
  review_requested?: boolean
  review_note?: string | null
  push_to_pm?: boolean
  push_to_admin?: boolean
  svan_view?: string | null
  svan_rating?: SvanRating | null
}

/** A row of `cc_activity_feed` -- the event plus everything the UI shows beside it. */
export interface ActivityFeedRow {
  event_id: string
  organization_id: string | null
  coverage_id: string
  ticker: string
  company_name: string | null
  sector: string | null
  lead_analyst_id: string | null
  kind: EventKind
  subtype: EventSubtype | null
  title: string
  event_date: string
  is_scheduled: boolean
  attendance: Attendance
  period_label: string | null
  thesis_impact: ThesisImpact | null
  kta: string | null
  open_questions: string | null
  broker_id: string | null
  broker_name: string | null
  analyst_id: string | null
  analyst_username: string | null
  created_by: string
  created_by_username: string | null
  created_at: string
  updated_at: string
  attachment_count: number
  contact_count: number
  /**
   * The analyst pushed this entry to someone. Derived in the database from the two
   * push flags below, and kept because the analyst-facing "Waiting on your PM" group
   * reads it as "I escalated this and nobody has answered yet".
   */
  review_requested?: boolean
  review_note?: string | null
  /**
   * Explicit escalation targets, set by the analyst. Independent: an entry pushed only
   * to the PM never appears in an admin's queue. Added by the push-targets migration --
   * undefined on a database without it, which reads as "not pushed".
   */
  push_to_pm?: boolean
  push_to_admin?: boolean
  comment_count?: number
  /**
   * The analyst's own opinion and where they stand on the stock. Added by
   * migration_command_center_svan_view.sql -- undefined on a database without it.
   */
  svan_view?: string | null
  svan_rating?: SvanRating | null
}

/** A row of the `cc_search_events` RPC. `snippet` carries <mark> tags. */
export interface EventSearchHit {
  event_id: string
  coverage_id: string
  ticker: string
  company_name: string | null
  kind: EventKind
  title: string
  event_date: string
  analyst_id: string | null
  analyst_username: string | null
  broker_name: string | null
  snippet: string | null
  rank: number
}

/**
 * An attachment is EITHER an uploaded object (`storage_path`) OR an external link
 * (`external_url`) -- never both, never neither. A CHECK constraint enforces that.
 */
export interface EventAttachment {
  id: string
  event_id: string
  storage_path: string | null
  external_url: string | null
  file_name: string
  mime_type: string | null
  size_bytes: number | null
  uploaded_by: string
  created_at: string
}

export interface Contact {
  id: string
  coverage_id: string
  organization_id: string | null
  name: string
  designation: ContactDesignation
  designation_other: string | null
  email: string | null
  phone: string | null
  created_by: string
  created_at: string
  updated_at: string
}

/**
 * A row of `cc_contact_last_met`. `last_met_on` is DERIVED from the most recent
 * non-scheduled event tagging this contact -- there is no stored column for it, so it
 * cannot go stale when a meeting is back-dated or deleted.
 */
export interface ContactWithRecency extends Contact {
  last_met_on: string | null
  last_event_id: string | null
  next_meeting_on: string | null
}

/** What the Log sheet collects before it becomes a `cc_events` row. */
export interface EventDraft {
  coverage_id: string
  kind: EventKind
  subtype?: EventSubtype | null
  title: string
  event_date: string
  is_scheduled?: boolean
  attendance?: Attendance
  period_label?: string | null
  broker_id?: string | null
  kta?: string | null
  thesis_impact?: ThesisImpact | null
  open_questions?: string | null
  analyst_id?: string | null
  contact_ids?: string[]
  /** Derived from the push targets; written alongside them. */
  review_requested?: boolean
  /** Push this entry to a portfolio manager / an org admin, with the question for them. */
  push_to_pm?: boolean
  push_to_admin?: boolean
  review_note?: string | null
  svan_view?: string | null
  svan_rating?: SvanRating | null
}

export interface ActivityFilters {
  analystId?: string | null
  coverageId?: string | null
  kinds?: EventKind[]
  brokerId?: string | null
  from?: string | null
  to?: string | null
  search?: string
}

// ---------------------------------------------------------------------------
// Comments and teams (database/migration_command_center_home.sql)
// ---------------------------------------------------------------------------

/** Who has commented on which entry -- enough to tell whether a push was answered. */
export interface CommentAuthor {
  event_id: string
  author_id: string
}

export interface EventComment {
  id: string
  event_id: string
  author_id: string
  author_username: string | null
  body: string
  created_at: string
}

export interface TeamOption {
  id: string
  name: string
  /** Admin of the org, or a PM who belongs to this team. */
  is_manager: boolean
  member_count: number
}

export interface RosterMember {
  user_id: string
  username: string | null
  role: string
  team_ids: string[]
}
