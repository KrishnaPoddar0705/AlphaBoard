import { useMemo } from 'react';
import { useSkin } from '@/contexts/SkinContext';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Resolved chart colours for the active skin, for libraries that need literal
 * colour strings: Nivo animates colours through react-spring and Highcharts
 * parses them for hover shading, so neither can take `var(--color-ink)`.
 * Recharts and plain `style` objects should use the CSS variables directly.
 *
 * Static table rather than getComputedStyle: SkinContext writes `data-skin` in
 * an effect, after the render that reads this, so reading the DOM would lag a
 * toggle by one render. Keep in sync with src/index.css (paper) and
 * src/styles/board-skin.css (board).
 */
export interface SkinColors {
  ink: string;
  inkMuted: string;
  inkFaint: string;
  border: string;
  grid: string;
  surface: string;
  surfaceAlt: string;
  page: string;
  positive: string;
  negative: string;
  chartOrange: string;
  chartSalmon: string;
  fontFamily: string;
}

const PAPER: SkinColors = {
  ink: '#1C1B17',
  inkMuted: '#6F6A60',
  inkFaint: '#8B857A',
  border: '#D7D0C2',
  grid: '#E3DDCF',
  surface: '#F7F2E6',
  surfaceAlt: '#FBF7ED',
  page: '#F1EEE0',
  positive: '#2F8F5B',
  negative: '#B23B2A',
  chartOrange: '#D06030',
  chartSalmon: '#F09070',
  fontFamily: 'ui-monospace, monospace',
};

const BOARD: SkinColors = {
  ink: '#0a0a0a',
  inkMuted: '#737373',
  inkFaint: '#a1a1a1',
  border: '#ebebeb',
  grid: '#ebebeb',
  surface: '#ffffff',
  surfaceAlt: '#f7f7f7',
  page: '#ffffff',
  positive: '#00a63e',
  negative: '#e7000b',
  chartOrange: '#ff6900',
  chartSalmon: '#ff8904',
  fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
};

const BOARD_DARK: SkinColors = {
  ...BOARD,
  ink: '#fafafa',
  inkMuted: '#a1a1a1',
  inkFaint: '#737373',
  border: '#333333',
  grid: '#2e2e2e',
  surface: '#262626',
  surfaceAlt: '#262626',
  page: '#171717',
  positive: '#05df72',
  negative: '#ff6467',
};

export function skinColors(skin: 'paper' | 'board', theme: 'light' | 'dark'): SkinColors {
  if (skin === 'paper') return PAPER;
  return theme === 'dark' ? BOARD_DARK : BOARD;
}

export function useSkinColors(): SkinColors {
  const { skin } = useSkin();
  const { theme } = useTheme();
  return useMemo(() => skinColors(skin, theme), [skin, theme]);
}
