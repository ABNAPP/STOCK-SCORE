import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGlobalSearch, SearchResult } from '../hooks/useGlobalSearch';
import { ViewId } from '../types/navigation';
import { useDebounce } from '../hooks/useDebounce';
import { sanitizeSearchQuery } from '../utils/inputValidator';

interface GlobalSearchProps {
  onNavigate: (viewId: ViewId) => void;
}

export default function GlobalSearch({ onNavigate }: GlobalSearchProps) {
  const { t } = useTranslation();
  const { search } = useGlobalSearch();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Debounce the search query with 300ms delay
  const debouncedQuery = useDebounce(query, 300);

  // Perform search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.trim().length > 0) {
      // Sanitize the search query before using it
      const sanitizedQuery = sanitizeSearchQuery(debouncedQuery);
      const searchResults = search(sanitizedQuery);
      setResults(searchResults);
      setIsOpen(searchResults.length > 0);
      setSelectedIndex(-1);
    } else {
      setResults([]);
      setIsOpen(false);
    }
  }, [debouncedQuery, search]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelectResult(results[selectedIndex]);
        } else if (results.length > 0) {
          handleSelectResult(results[0]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setQuery('');
        inputRef.current?.blur();
        break;
    }
  };

  const handleSelectResult = (result: SearchResult) => {
    onNavigate(result.viewId);
    setIsOpen(false);
    setQuery('');
    inputRef.current?.blur();
  };

  const getTypeLabel = (type: SearchResult['type']): string => {
    const labels: Record<SearchResult['type'], string> = {
      'score-board': t('navigation.scoreBoard'),
      'benjamin-graham': t('navigation.benjaminGraham'),
      'pe-industry': t('navigation.peIndustry'),
      'entry-exit': t('navigation.tachart'),
      'threshold-industry': t('navigation.thresholdIndustry'),
    };
    return labels[type] || type;
  };

  return (
    <div ref={searchRef} className="relative w-full max-w-md">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg
            className="h-5 w-5 text-gray-600 dark:text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            // Sanitize input as user types
            const sanitized = sanitizeSearchQuery(e.target.value);
            setQuery(sanitized);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) {
              setIsOpen(true);
            }
          }}
          placeholder={t('globalSearch.placeholder', 'Sök i alla tabeller...')}
          maxLength={200}
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-500 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-600 dark:placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-sm"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-200 transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer min-h-[44px] min-w-[44px] touch-manipulation justify-center"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-300 dark:border-gray-500 max-h-96 overflow-y-auto animate-fade-in-up">
          <div className="p-2">
            {results.map((result, index) => (
              <button
                key={result.id}
                onClick={() => handleSelectResult(result)}
                className={`w-full text-left px-3 py-3 sm:py-2 rounded-md transition-all duration-200 min-h-[44px] touch-manipulation ${
                  index === selectedIndex
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100 scale-[1.02]'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 hover:scale-[1.01] active:scale-95'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                        {getTypeLabel(result.type)}
                      </span>
                    </div>
                    <div className="mt-1 truncate">
                      <span className="font-medium">{result.label}</span>
                    </div>
                    {result.ticker && result.companyName && (
                      <div className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                        {result.ticker}
                        {result.industry && ` • ${result.industry}`}
                      </div>
                    )}
                  </div>
                  <svg
                    className="w-4 h-4 text-gray-600 dark:text-gray-300 ml-2 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {isOpen && query.trim().length > 0 && results.length === 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-300 dark:border-gray-500 p-4 animate-fade-in-up">
          <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
            {t('globalSearch.noResults', 'Inga resultat hittades')}
          </p>
        </div>
      )}
    </div>
  );
}

