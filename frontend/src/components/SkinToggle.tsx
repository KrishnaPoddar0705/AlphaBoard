import { LayoutGrid, Newspaper } from 'lucide-react';
import { useSkin } from '@/contexts/SkinContext';
import type { Skin } from '@/contexts/SkinContext';

const OPTIONS: { value: Skin; label: string; Icon: typeof Newspaper }[] = [
  { value: 'paper', label: 'Paper', Icon: Newspaper },
  { value: 'board', label: 'Board', Icon: LayoutGrid },
];

/** Paper / Board segmented control for the top nav. Labels collapse to icons below `sm`. */
export function SkinToggle() {
  const { skin, setSkin } = useSkin();

  return (
    <div
      role="radiogroup"
      aria-label="Interface skin"
      className="flex shrink-0 items-center gap-0.5 rounded-md border border-border-editorial bg-paper-light p-0.5 board:rounded-lg board:border-transparent board:bg-[var(--board-segment-track)]"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = skin === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            title={`${label} skin`}
            onClick={() => setSkin(value)}
            className={
              'flex h-7 items-center gap-1.5 rounded px-2 text-xs font-medium transition-colors board:rounded-md ' +
              (active
                ? 'bg-ink text-paper-light board:bg-paper-light board:text-ink board:shadow-card'
                : 'text-ink-muted hover:text-ink')
            }
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
