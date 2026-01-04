/**
 * Deterministic thread icon mapping for stocks
 * Each ticker gets a consistent icon based on a hash of the ticker string
 */

import {
  MessageSquare,
  MessagesSquare,
  Newspaper,
  TrendingUp,
  LineChart,
  BarChart3,
  Briefcase,
  Building2,
  Globe,
  Cpu,
  Factory,
  Landmark,
  type LucideIcon,
} from 'lucide-react';

// Icon set for thread icons (8-12 icons as specified)
const THREAD_ICONS: LucideIcon[] = [
  MessageSquare,
  MessagesSquare,
  Newspaper,
  TrendingUp,
  LineChart,
  BarChart3,
  Briefcase,
  Building2,
  Globe,
  Cpu,
  Factory,
  Landmark,
];

/**
 * Simple hash function to convert string to number
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Get a deterministic thread icon for a ticker
 * @param ticker - Stock ticker symbol
 * @returns LucideIcon component
 */
export function getThreadIconByTicker(ticker: string): LucideIcon {
  const hash = hashString(ticker.toUpperCase());
  const index = hash % THREAD_ICONS.length;
  return THREAD_ICONS[index];
}

