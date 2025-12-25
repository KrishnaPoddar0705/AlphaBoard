import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import { searchStocks } from '../../lib/api';

interface StockResult {
  symbol: string;
  name: string;
}

interface TickerInputProps {
  value: string[];
  onChange: (tickers: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function TickerInput({
  value,
  onChange,
  disabled = false,
  placeholder = 'e.g., AAPL, MSFT, GOOGL',
}: TickerInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [searchResults, setSearchResults] = useState<StockResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<number | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Search stocks when input changes
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const query = inputValue.trim().toUpperCase();

    if (query.length === 0) {
      setSearchResults([]);
      setIsOpen(false);
      return;
    }

    if (query.length < 2) {
      setSearchResults([]);
      setIsOpen(false);
      return;
    }

    // Debounce search
    searchTimeoutRef.current = window.setTimeout(async () => {
      setIsSearching(true);
      setIsOpen(true);
      try {
        const results = await searchStocks(query);
        if (results && Array.isArray(results) && results.length > 0) {
          setSearchResults(results.slice(0, 8)); // Limit to 8 results
        } else {
          setSearchResults([]);
        }
      } catch (err) {
        console.warn('Stock search failed:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [inputValue]);

  const handleSelectTicker = (symbol: string) => {
    const normalizedSymbol = symbol.trim().toUpperCase();
    
    // Don't add if already exists
    if (value.includes(normalizedSymbol)) {
      setInputValue('');
      setIsOpen(false);
      return;
    }

    // Add ticker
    onChange([...value, normalizedSymbol]);
    setInputValue('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleRemoveTicker = (tickerToRemove: string) => {
    onChange(value.filter((t) => t !== tickerToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      const normalizedSymbol = inputValue.trim().toUpperCase();
      if (normalizedSymbol && !value.includes(normalizedSymbol)) {
        handleSelectTicker(normalizedSymbol);
      }
    } else if (e.key === 'Backspace' && inputValue === '' && value.length > 0) {
      // Remove last ticker when backspace is pressed on empty input
      handleRemoveTicker(value[value.length - 1]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Input Container */}
      <div
        className={`w-full min-h-[42px] bg-white/5 border-2 rounded-lg px-3 py-2 transition-all duration-300 ${
          disabled
            ? 'border-white/10 opacity-50 cursor-not-allowed'
            : isOpen
            ? 'border-blue-500 bg-white/10'
            : 'border-white/10 hover:border-blue-500/50'
        } flex flex-wrap items-center gap-2`}
      >
        {/* Ticker Pills */}
        {value.map((ticker) => (
          <motion.div
            key={ticker}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full text-sm font-medium text-white"
          >
            <span>{ticker}</span>
            {!disabled && (
              <button
                type="button"
                onClick={() => handleRemoveTicker(ticker)}
                className="hover:bg-blue-500/30 rounded-full p-0.5 transition-colors"
                tabIndex={-1}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </motion.div>
        ))}

        {/* Input Field */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => inputValue.trim().length >= 2 && setIsOpen(true)}
          disabled={disabled}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-white placeholder-gray-500 text-sm"
        />

        {/* Search Icon */}
        {isSearching && (
          <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
        )}
      </div>

      {/* Search Results Dropdown */}
      <AnimatePresence>
        {isOpen && !disabled && (searchResults.length > 0 || isSearching) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute z-50 w-full mt-2 rounded-lg border-2 border-white/20 bg-black overflow-hidden shadow-2xl max-h-60 overflow-y-auto"
          >
            {isSearching ? (
              <div className="flex items-center justify-center px-4 py-3 text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                <span className="text-sm">Searching...</span>
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map((result, index) => (
                <motion.button
                  key={result.symbol}
                  type="button"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.03 }}
                  onClick={() => handleSelectTicker(result.symbol)}
                  disabled={value.includes(result.symbol)}
                  className={`w-full px-4 py-3 text-left transition-colors duration-200 ${
                    value.includes(result.symbol)
                      ? 'bg-gray-800/50 text-gray-500 cursor-not-allowed'
                      : 'hover:bg-white/10 text-white'
                  } flex items-start justify-between group ${
                    index !== searchResults.length - 1 ? 'border-b border-white/10' : ''
                  }`}
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm">{result.symbol}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{result.name}</div>
                  </div>
                  {value.includes(result.symbol) && (
                    <div className="text-xs text-gray-500 ml-2">Added</div>
                  )}
                </motion.button>
              ))
            ) : inputValue.trim().length >= 2 ? (
              <div className="px-4 py-3 text-gray-400 text-sm text-center">
                No results found for "{inputValue}"
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Helper Text */}
      <p className="text-xs text-gray-500 mt-1">
        {value.length === 0
          ? 'Enter ticker symbols separated by commas or search'
          : `${value.length} ticker${value.length !== 1 ? 's' : ''} selected`}
      </p>
    </div>
  );
}

