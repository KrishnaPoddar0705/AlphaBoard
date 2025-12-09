import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, X, Search } from 'lucide-react';

interface TickerFilterProps {
  value: string[];
  onChange: (tickers: string[]) => void;
  options: string[];
  disabled?: boolean;
  placeholder?: string;
}

export default function TickerFilter({
  value,
  onChange,
  options,
  disabled = false,
  placeholder = 'Select tickers...',
}: TickerFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });

  // Filter options based on search term
  const filteredOptions = options.filter((ticker) =>
    ticker.toUpperCase().includes(searchTerm.toUpperCase())
  );

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
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Close on escape key
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setIsOpen(false);
          setSearchTerm('');
        }
      };
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen]);

  const handleToggleTicker = (ticker: string) => {
    if (value.includes(ticker)) {
      onChange(value.filter((t) => t !== ticker));
    } else {
      onChange([...value, ticker]);
    }
  };

  const handleRemoveTicker = (ticker: string) => {
    onChange(value.filter((t) => t !== ticker));
  };

  const handleClearAll = () => {
    onChange([]);
  };

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
            zIndex: 9999,
          }}
          className="rounded-xl border-2 border-[var(--border-color)] bg-[var(--card-bg)] backdrop-blur-md overflow-hidden shadow-2xl max-h-64 flex flex-col"
        >
          {/* Search Input */}
          <div className="p-3 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search tickers..."
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-9 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-indigo-500 focus:bg-[var(--list-item-hover)] transition-all"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Options List */}
          <div className="overflow-y-auto max-h-48 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((ticker, index) => {
                const isSelected = value.includes(ticker);
                return (
                  <motion.button
                    key={ticker}
                    type="button"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.15, delay: index * 0.02 }}
                    onClick={() => handleToggleTicker(ticker)}
                    className={`w-full px-4 py-3 text-left transition-all duration-150 ${
                      isSelected
                        ? 'bg-indigo-500/30 text-[var(--text-primary)] border-l-2 border-indigo-500'
                        : 'hover:bg-[var(--list-item-hover)] text-[var(--text-primary)] hover:border-l-2 hover:border-indigo-500/50'
                    } flex items-center justify-between group ${
                      index !== filteredOptions.length - 1 ? 'border-b border-[var(--border-color)]' : ''
                    }`}
                  >
                    <span className="font-medium text-sm">{ticker}</span>
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center"
                      >
                        <span className="text-xs text-white">✓</span>
                      </motion.div>
                    )}
                  </motion.button>
                );
              })
            ) : (
              <div className="px-4 py-3 text-[var(--text-secondary)] text-sm text-center">
                {searchTerm ? `No tickers found for "${searchTerm}"` : 'No tickers available'}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <div className="relative" ref={containerRef}>
        {/* Selected Tickers Display */}
        {value.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {value.map((ticker) => (
              <motion.div
                key={ticker}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/20 border border-blue-500/30 rounded-md text-xs font-medium text-white"
              >
                <span>{ticker}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => handleRemoveTicker(ticker)}
                    className="hover:bg-blue-500/30 rounded-full p-0.5 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </motion.div>
            ))}
            {!disabled && value.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="px-2 py-1 text-xs text-gray-400 hover:text-white transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
        )}

        {/* Dropdown Button */}
        <motion.button
          ref={buttonRef}
          type="button"
          whileHover={disabled ? {} : { scale: 1.01 }}
          whileTap={disabled ? {} : { scale: 0.99 }}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`w-full px-4 py-2.5 rounded-lg border-2 transition-all duration-200 ${
            disabled
              ? 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-tertiary)] cursor-not-allowed opacity-50'
              : isOpen
              ? 'bg-[var(--list-item-hover)] border-indigo-500 text-[var(--text-primary)] shadow-lg shadow-indigo-500/20'
              : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--list-item-hover)] hover:border-indigo-500/50'
          } flex items-center justify-between group`}
        >
          <span className={`font-medium text-sm ${value.length === 0 ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}>
            {value.length === 0 ? placeholder : `${value.length} ticker${value.length !== 1 ? 's' : ''} selected`}
          </span>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors" />
          </motion.div>
        </motion.button>
      </div>

      {/* Render dropdown menu in portal */}
      {typeof window !== 'undefined' && createPortal(dropdownMenu, document.body)}
    </>
  );
}

