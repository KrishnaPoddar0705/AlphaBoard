/**
 * Shapes shared by the Admin Dashboard and the Team Dashboard.
 *
 * These used to be local interfaces inside AdminDashboard.tsx. They moved here when
 * the Team Dashboard started composing the same table and row-detail components --
 * two dashboards reading one set of types is the whole point of the split.
 */

import type { OrgRole } from '../../../hooks/useOrganization';

export interface OrganizationUser {
  userId: string;
  username: string | null;
  email: string | null;
  role: OrgRole;
  joinedAt: string;
}

export interface Recommendation {
  id: string;
  user_id?: string;
  ticker: string;
  position?: string;
  entry_price: number;
  exit_price?: number;
  action?: string;
  status?: string;
  thesis: string;
  entry_date: string;
  created_at?: string;
  screenshots?: string[];
  images?: string[];
  final_return_pct?: number;
  final_alpha_pct?: number;
}

export interface IrrTarget {
  id: string;
  ticker: string;
  target_irr: number | null;
  timeframe_start_months: number | null;
  timeframe_end_months: number | null;
  created_at: string;
  /** Legacy fields, present only on rows created before IRR targets. */
  target_price: number | null;
  target_date: string | null;
}

export interface AnalystPerformance {
  userId: string;
  username: string | null;
  returns: {
    '1M': number;
    '3M': number;
    '6M': number;
    '12M': number;
  };
  sharpe: number;
  volatility: number;
  drawdown: number;
  totalRecommendations: number;
  openPositions: number;
  closedPositions: number;
  winRate: number;
  teams: Array<{ id: string; name: string }>;
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString();
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}
