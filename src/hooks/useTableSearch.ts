import { useMemo, useState } from 'react';
import { FilterValues } from '../components/AdvancedFilters';
import { useDebounce } from './useDebounce';
import { sanitizeSearchQuery } from '../utils/inputValidator';

interface UseTableSearchOptions<T> {
  data: T[];
  searchFields?: (keyof T)[];
  initialSearch?: string;
  advancedFilters?: FilterValues;
  debounceDelay?: number;
}

/**
 * Custom hook for table search and filtering
 * 
 * Provides search functionality with:
 * - Text search across multiple fields (with debouncing)
 * - Advanced filters (number ranges, boolean, text)
 * - XSS and regex injection protection via sanitization
 * - Case-insensitive matching
 * 
 * **Search Algorithm:**
 * - Debounced text search (300ms default) to reduce API calls
 * - Searches across all specified fields or all fields if none specified
 * - Uses includes() for substring matching (safe after sanitization)
 * - Advanced filters support: number ranges, exact matches, boolean filters
 * 
 * **Security:**
 * - All search queries are sanitized to prevent XSS and regex injection
 * - Special characters are escaped before use in string matching
 * 
 * @template T - Type of data items being searched
 * @param options - Search options
 * @param options.data - Array of data items to search
 * @param options.searchFields - Optional array of field names to search (defaults to all fields)
 * @param options.initialSearch - Initial search value (default: '')
 * @param options.advancedFilters - Advanced filter values (number ranges, etc.)
 * @param options.debounceDelay - Debounce delay in milliseconds (default: 300)
 * @returns Object with search value, setter, and filtered data
 * 
 * @example
 * ```typescript
 * const { searchValue, setSearchValue, filteredData } = useTableSearch({
 *   data: stockData,
 *   searchFields: ['companyName', 'ticker'],
 *   advancedFilters: { score: { min: 50, max: 100 } }
 * });
 * ```
 */
export function useTableSearch<T extends Record<string, any>>({
  data,
  searchFields,
  initialSearch = '',
  advancedFilters = {},
  debounceDelay = 300,
}: UseTableSearchOptions<T>) {
  const [searchValue, setSearchValue] = useState(initialSearch);
  const debouncedSearchValue = useDebounce(searchValue, debounceDelay);

  const filteredData = useMemo(() => {
    let result = data;

    // Apply text search (using debounced value)
    if (debouncedSearchValue.trim()) {
      // Sanitize search query to prevent XSS and regex injection
      const sanitizedQuery = sanitizeSearchQuery(debouncedSearchValue);
      const searchLower = sanitizedQuery.toLowerCase().trim();
      const fieldsToSearch = searchFields || (Object.keys(data[0] || {}) as (keyof T)[]);

      result = result.filter((item) => {
        return fieldsToSearch.some((field) => {
          const value = item[field];
          if (value === null || value === undefined) {
            return false;
          }
          // Use indexOf for safe string matching (sanitized query is safe)
          return String(value).toLowerCase().includes(searchLower);
        });
      });
    }

    // Apply advanced filters
    if (advancedFilters && Object.keys(advancedFilters).length > 0) {
      result = result.filter((item) => {
        return Object.entries(advancedFilters).every(([key, filterValue]) => {
          if (filterValue === null || filterValue === '' || filterValue === undefined) {
            return true; // No filter applied
          }

          const itemValue = item[key];

          // Handle null/undefined values
          if (itemValue === null || itemValue === undefined) {
            return false;
          }

          // Handle number range filter
          if (typeof filterValue === 'object' && filterValue !== null && ('min' in filterValue || 'max' in filterValue)) {
            const numValue = typeof itemValue === 'number' ? itemValue : parseFloat(String(itemValue));
            if (isNaN(numValue)) return false;
            
            const { min, max } = filterValue as { min?: number; max?: number };
            if (min !== undefined && numValue < min) return false;
            if (max !== undefined && numValue > max) return false;
            return true;
          }

          // Handle boolean filter
          if (typeof filterValue === 'boolean') {
            return Boolean(itemValue) === filterValue;
          }

          // Handle number filter
          if (typeof filterValue === 'number') {
            const numValue = typeof itemValue === 'number' ? itemValue : parseFloat(String(itemValue));
            return !isNaN(numValue) && numValue === filterValue;
          }

          // Handle text/string filter
          if (typeof filterValue === 'string') {
            return String(itemValue).toLowerCase().includes(filterValue.toLowerCase());
          }

          return true;
        });
      });
    }

    return result;
  }, [data, debouncedSearchValue, searchFields, advancedFilters]);

  return {
    searchValue,
    setSearchValue,
    filteredData,
  };
}

