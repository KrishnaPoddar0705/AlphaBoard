import {
  Users, Factory, Presentation, Phone, PhoneCall, BookOpen, FileBarChart,
  Landmark, CircleDot, type LucideIcon,
} from 'lucide-react'
import type {
  EventKind, EventSubtype, ContactDesignation, UnderstandingLevel, ModelStatus,
  ThesisImpact, SvanRating,
} from './types'

/**
 * What the analyst actually picks in the Log sheet. Six tiles, not a dropdown: the
 * whole point of this screen is that logging a meeting takes four taps.
 *
 * `management_meeting` is expanded into its subtypes here because "1:1" and "plant
 * visit" are what an analyst thinks in -- `kind` vs `subtype` is a storage detail.
 */
export interface EventTypeOption {
  id: string
  kind: EventKind
  subtype: EventSubtype | null
  label: string
  icon: LucideIcon
  /** Shown under the tile on desktop. */
  hint: string
  /** True where a period label (Q2 FY26 / FY25) is the natural second field. */
  wantsPeriod?: boolean
  /** True where "did we attend / have we read it" is meaningful. */
  wantsAttendance?: boolean
  wantsBroker?: boolean
}

export const EVENT_TYPES: EventTypeOption[] = [
  { id: '1:1', kind: 'management_meeting', subtype: '1:1',
    label: '1:1', icon: Users, hint: 'One-on-one with management' },
  { id: 'plant_visit', kind: 'management_meeting', subtype: 'plant_visit',
    label: 'Plant Visit', icon: Factory, hint: 'Site or facility visit' },
  { id: 'conference', kind: 'management_meeting', subtype: 'conference',
    label: 'Conference', icon: Presentation, hint: 'Investor or industry conference' },
  { id: 'group_meeting', kind: 'management_meeting', subtype: 'group_meeting',
    label: 'Group Meeting', icon: Users, hint: 'Group or NDR meeting' },
  { id: 'call', kind: 'management_meeting', subtype: 'call',
    label: 'Call', icon: Phone, hint: 'Ad-hoc call with management' },
  { id: 'concall', kind: 'concall', subtype: null,
    label: 'Concall', icon: PhoneCall, hint: 'Quarterly earnings call',
    wantsPeriod: true, wantsAttendance: true },
  { id: 'annual_report', kind: 'annual_report', subtype: null,
    label: 'Annual Report', icon: BookOpen, hint: 'Annual report read-through',
    wantsPeriod: true, wantsAttendance: true },
  { id: 'broker_report', kind: 'broker_report', subtype: null,
    label: 'Broker Report', icon: FileBarChart, hint: 'Sell-side research note',
    wantsBroker: true },
  { id: 'agm', kind: 'agm', subtype: null,
    label: 'AGM', icon: Landmark, hint: 'Annual general meeting', wantsPeriod: true },
  { id: 'other', kind: 'other', subtype: null,
    label: 'Other', icon: CircleDot, hint: 'Anything else worth logging' },
]

/** The six tiles the quick-capture sheet leads with; the rest sit behind "More". */
export const PRIMARY_EVENT_TYPE_IDS = [
  '1:1', 'plant_visit', 'conference', 'concall', 'annual_report', 'broker_report',
]

export function eventTypeOf(kind: EventKind, subtype?: EventSubtype | null): EventTypeOption {
  return (
    EVENT_TYPES.find((t) => t.kind === kind && t.subtype === (subtype ?? null)) ??
    EVENT_TYPES.find((t) => t.kind === kind) ??
    EVENT_TYPES[EVENT_TYPES.length - 1]
  )
}

export const KIND_LABELS: Record<EventKind, string> = {
  management_meeting: 'Management',
  concall: 'Concall',
  annual_report: 'Annual Report',
  broker_report: 'Broker Report',
  agm: 'AGM',
  other: 'Other',
}

export const CONTACT_DESIGNATIONS: ContactDesignation[] =
  ['IR', 'CSO', 'CFO', 'MD', 'CEO', 'COO', 'Chairman', 'Other']

export const UNDERSTANDING_LEVELS: { value: UnderstandingLevel; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

export const MODEL_STATUSES: { value: ModelStatus; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'basic', label: 'Basic' },
  { value: 'detailed', label: 'Detailed' },
]

/** Terminal glyphs for a thesis impact: ▲ strengthened, ▼ weakened, ■ no change. */
export const SIGNAL: Record<ThesisImpact, { glyph: string; color: string }> = {
  positive: { glyph: '▲', color: '#2F8F5B' },
  negative: { glyph: '▼', color: '#B23B2A' },
  neutral: { glyph: '■', color: '#8B857A' },
}

export const THESIS_IMPACTS: { value: ThesisImpact; label: string; color: string }[] = [
  { value: 'positive', label: 'Positive', color: '#2F8F5B' },
  { value: 'neutral',  label: 'Neutral',  color: '#6F6A60' },
  { value: 'negative', label: 'Negative', color: '#B23B2A' },
]

/** The Svan View meter, in order, coloured from red (strong sell) to green (strong buy). */
export const SVAN_RATINGS: { value: SvanRating; label: string; color: string }[] = [
  { value: 'strong_sell', label: 'Strong Sell', color: '#B23B2A' },
  { value: 'sell',        label: 'Sell',        color: '#D06030' },
  { value: 'neutral',     label: 'Neutral',     color: '#A8892B' },
  { value: 'buy',         label: 'Buy',         color: '#5FA777' },
  { value: 'strong_buy',  label: 'Strong Buy',  color: '#2F8F5B' },
]

export function svanRatingOf(value: SvanRating | null | undefined) {
  return SVAN_RATINGS.find((r) => r.value === value) ?? null
}

/**
 * Coverage-health bands, in days since the last logged interaction.
 *
 * These are the whole point of the board: a red card is a name nobody has touched in a
 * quarter, which is exactly what an admin wants to see without asking anyone.
 */
export const HEALTH_BANDS = {
  fresh: 30,   // under 30 days
  stale: 90,   // 30-89 days
} as const

export type HealthBand = 'fresh' | 'stale' | 'cold' | 'untouched'

export function healthBandFor(daysSince: number | null): HealthBand {
  if (daysSince === null) return 'untouched'
  if (daysSince < HEALTH_BANDS.fresh) return 'fresh'
  if (daysSince < HEALTH_BANDS.stale) return 'stale'
  return 'cold'
}

/** Paper-theme colours for each band. Hex, matching the rest of the codebase. */
export const HEALTH_COLORS: Record<HealthBand, { dot: string; text: string }> = {
  fresh:     { dot: '#2F8F5B', text: '#2F8F5B' },
  stale:     { dot: '#D06030', text: '#D06030' },
  cold:      { dot: '#B23B2A', text: '#B23B2A' },
  untouched: { dot: '#8B857A', text: '#8B857A' },
}

/** Upload limits for the private `command-center` bucket. */
export const CC_BUCKET = 'command-center'
export const CC_MAX_FILE_BYTES = 50 * 1024 * 1024   // matches the bucket's own limit
export const CC_MAX_FILES = 10
/**
 * Short on purpose. A signed URL is a bearer credential: RLS gates minting it, not
 * using it, so once issued it works for anyone who has the string until it expires.
 * Broker research is licensed, so 5 minutes and re-mint, rather than the hour used for
 * community images.
 */
export const CC_SIGNED_URL_TTL_SECONDS = 300
