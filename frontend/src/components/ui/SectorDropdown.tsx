import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';

interface SectorDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  disabled?: boolean;
  placeholder?: string;
}

export default function SectorDropdown({
  value,
  onChange,
  options,
  disabled = false,
  placeholder = 'Select sector...',
}: SectorDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });

  // Update menu position when opening or scrolling
  useEffect(() => {
    const updatePosition = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setMenuPosition({
          top: rect.bottom + 8,
          left: rect.left,
          width: rect.width,
        });
      }
    };

    if (isOpen) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        updatePosition();
      });
      
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    } else {
      // Reset position when closed
      setMenuPosition({ top: 0, left: 0, width: 0 });
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      // Use a small delay to avoid immediate closure when opening
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside, true);
      }, 0);
      
      // Close on escape key
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setIsOpen(false);
      };
      document.addEventListener('keydown', handleEscape);
      
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('mousedown', handleClickOutside, true);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen]);

  const handleSelect = (option: string) => {
    onChange(option);
    setIsOpen(false);
  };

  const selectedLabel = value || placeholder;

  const dropdownMenu = (
    <AnimatePresence>
      {isOpen && !disabled && menuPosition.width > 0 && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed',
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
            width: `${menuPosition.width}px`,
            zIndex: 10000,
          }}
          className="rounded-xl border-2 border-[#D7D0C2] bg-[#F7F2E6] backdrop-blur-md overflow-hidden shadow-2xl max-h-60 overflow-y-auto pointer-events-auto"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {options.length > 0 ? (
            options.map((option, index) => (
              <motion.button
                key={option}
                type="button"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15, delay: index * 0.02 }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSelect(option);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className={`w-full px-4 py-3 text-left transition-all duration-150 ${
                  value === option
                    ? 'bg-[#1D4ED8]/10 text-[#1C1B17] border-l-2 border-[#1D4ED8]'
                    : 'hover:bg-[#FBF7ED] text-[#1C1B17] hover:border-l-2 hover:border-[#1D4ED8]/50'
                } flex items-center justify-between group ${
                  index !== options.length - 1 ? 'border-b border-[#D7D0C2]' : ''
                }`}
              >
                <span className="font-medium text-sm">{option}</span>
                {value === option && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  >
                    <Check className="w-5 h-5 text-[#1D4ED8]" />
                  </motion.div>
                )}
              </motion.button>
            ))
          ) : (
            <div className="px-4 py-3 text-[#6F6A60] text-sm text-center">
              No options available
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {/* Dropdown Button */}
        <motion.button
          ref={buttonRef}
          type="button"
          whileHover={disabled ? {} : { scale: 1.01 }}
          whileTap={disabled ? {} : { scale: 0.99 }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!disabled) {
              setIsOpen(!isOpen);
            }
          }}
          disabled={disabled}
          className={`w-full px-4 py-2.5 rounded-lg border-2 transition-all duration-200 ${
            disabled
              ? 'bg-[#FBF7ED] border-[#D7D0C2] text-[#8B857A] cursor-not-allowed opacity-50'
              : isOpen
              ? 'bg-[#FBF7ED] border-[#1D4ED8] text-[#1C1B17] shadow-lg shadow-[#1D4ED8]/20'
              : 'bg-[#FBF7ED] border-[#D7D0C2] text-[#1C1B17] hover:bg-[#F7F2E6] hover:border-[#1D4ED8]/50'
          } flex items-center justify-between group`}
        >
          <span className={`font-medium text-sm ${!value ? 'text-[#6F6A60]' : 'text-[#1C1B17]'}`}>
            {selectedLabel}
          </span>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-4 h-4 text-[#6F6A60] group-hover:text-[#1C1B17] transition-colors" />
          </motion.div>
        </motion.button>
      </div>

      {/* Render dropdown menu in portal */}
      {typeof window !== 'undefined' && createPortal(dropdownMenu, document.body)}
    </>
  );
}

