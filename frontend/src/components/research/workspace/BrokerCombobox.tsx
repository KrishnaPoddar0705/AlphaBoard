import { useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, Plus } from 'lucide-react';

interface BrokerComboboxProps {
  value: string;
  onChange: (v: string) => void;
  /** Broker names to offer: Command Center's broker list plus those already on reports. */
  options: string[];
  loading?: boolean;
}

/**
 * Pick a broker from the desk's list, or type one that isn't there. A plain input with a
 * filtered list under it; arrows and Enter work, and Escape closes the list.
 */
export default function BrokerCombobox({ value, onChange, options, loading }: BrokerComboboxProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = value.trim().toLowerCase();
  const matches = useMemo(() => (q ? options.filter((o) => o.toLowerCase().includes(q)) : options), [options, q]);
  const exact = options.some((o) => o.toLowerCase() === q);
  const rows = [...matches, ...(q && !exact ? [`__new__${value.trim()}`] : [])];

  const pick = (row: string) => {
    onChange(row.startsWith('__new__') ? row.slice(7) : row);
    setOpen(false);
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        aria-controls="broker-options"
        aria-autocomplete="list"
        value={value}
        placeholder="Choose or type a broker"
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, rows.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
          else if (e.key === 'Enter' && open && rows[active]) { e.preventDefault(); pick(rows[active]); }
          else if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); }
        }}
        className="h-9 w-full rounded-md border border-[#D7D0C2] bg-[#FBF7ED] pl-3 pr-8 text-base text-[#1C1B17] placeholder:text-[#8B857A] focus:border-[#1C1B17]/50 focus:outline-none md:text-sm"
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Show brokers"
        onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o); inputRef.current?.focus(); }}
        className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-[#6F6A60] hover:text-[#1C1B17]"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>

      {open && (
        <ul id="broker-options" role="listbox" className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-[#D7D0C2] bg-[#FBF7ED] py-1 shadow-[0_10px_24px_-12px_rgba(28,27,23,0.35)]">
          {rows.length === 0 && <li className="px-3 py-2 text-sm text-[#6F6A60]">{loading ? 'Loading brokers…' : 'No brokers yet. Type a name to add one.'}</li>}
          {rows.map((row, i) => {
            const isNew = row.startsWith('__new__');
            const label = isNew ? row.slice(7) : row;
            const selected = !isNew && label.toLowerCase() === q;
            return (
              <li
                key={row}
                role="option"
                aria-selected={selected}
                onMouseDown={(e) => { e.preventDefault(); pick(row); }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-[#1C1B17] ${i === active ? 'bg-[#1C1B17]/[0.06]' : ''}`}
              >
                {isNew ? <Plus className="h-3.5 w-3.5 text-[#6F6A60]" /> : <Check className={`h-3.5 w-3.5 ${selected ? 'text-[#1D4ED8]' : 'invisible'}`} />}
                {isNew ? <span>Use “{label}”</span> : <span className="truncate">{label}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
