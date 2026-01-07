import { useMemo, useState } from 'react';
import { FilterValues } from '../components/AdvancedFilters';
import { useDebounce } from './useDebounce';

interface UseTableSearchOptions<T> {
  data: T[];
  searchFields?: (keyof T)[];
  initialSearch?: string;
  advancedFilters?: FilterValues;
  debounceDelay?: number;
}

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
      const searchLower = debouncedSearchValue.toLowerCase().trim();
      const fieldsToSearch = searchFields || (Object.keys(data[0] || {}) as (keyof T)[]);

      result = result.filter((item) => {
        return fieldsToSearch.some((field) => {
          const value = item[field];
          if (value === null || value === undefined) {
            return false;
          }
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

