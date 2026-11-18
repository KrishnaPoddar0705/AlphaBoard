import { Select as SelectPrimitive } from 'radix-ui';
import { ChevronDown, Check } from 'lucide-react';

interface SectorDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  disabled?: boolean;
  placeholder?: string;
}

// Built on Radix Select so it works inside Radix dialogs: the menu takes part in
// the dialog's scroll lock (a hand-rolled body portal can't be wheel-scrolled
// while a modal is open) and flips/clamps to stay inside the viewport.
export default function SectorDropdown({
  value,
  onChange,
  options,
  disabled = false,
  placeholder = 'Select sector...',
}: SectorDropdownProps) {
  const container =
    typeof document !== 'undefined' ? document.getElementById('radix-portal-root') : null;

  return (
    <SelectPrimitive.Root value={value} onValueChange={onChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        className="group w-full px-4 py-2.5 rounded-lg border-2 bg-[#FBF7ED] border-[#D7D0C2] text-[#1C1B17] flex items-center justify-between gap-2 transition-all duration-200 outline-none hover:bg-[#F7F2E6] hover:border-[#1D4ED8]/50 focus-visible:border-[#1D4ED8] data-[state=open]:border-[#1D4ED8] data-[state=open]:shadow-lg data-[state=open]:shadow-[#1D4ED8]/20 disabled:cursor-not-allowed disabled:opacity-50 disabled:text-[#8B857A] disabled:hover:bg-[#FBF7ED] disabled:hover:border-[#D7D0C2]"
      >
        <span className="font-medium text-sm truncate">
          <SelectPrimitive.Value placeholder={<span className="text-[#6F6A60]">{placeholder}</span>} />
        </span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="w-4 h-4 shrink-0 text-[#6F6A60] transition-transform duration-200 group-data-[state=open]:rotate-180 group-hover:text-[#1C1B17]" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal container={container ?? undefined}>
        <SelectPrimitive.Content
          position="popper"
          side="bottom"
          sideOffset={8}
          collisionPadding={16}
          className="z-[60] w-[var(--radix-select-trigger-width)] max-h-[min(15rem,var(--radix-select-content-available-height))] rounded-xl border-2 border-[#D7D0C2] bg-[#F7F2E6] shadow-2xl overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <SelectPrimitive.Viewport className="max-h-[inherit] overflow-y-auto overscroll-contain">
            {options.length > 0 ? (
              options.map((option, index) => (
                <SelectPrimitive.Item
                  key={option}
                  value={option}
                  className={`w-full px-4 py-3 text-left text-[#1C1B17] flex items-center justify-between cursor-pointer outline-none select-none transition-colors duration-150 data-[highlighted]:bg-[#FBF7ED] data-[state=checked]:bg-[#1D4ED8]/10 data-[state=checked]:border-l-2 data-[state=checked]:border-l-[#1D4ED8] ${
                    index !== options.length - 1 ? 'border-b border-[#D7D0C2]' : ''
                  }`}
                >
                  <SelectPrimitive.ItemText>
                    <span className="font-medium text-sm">{option}</span>
                  </SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator>
                    <Check className="w-5 h-5 text-[#1D4ED8]" />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))
            ) : (
              <div className="px-4 py-3 text-[#6F6A60] text-sm text-center">
                No options available
              </div>
            )}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
