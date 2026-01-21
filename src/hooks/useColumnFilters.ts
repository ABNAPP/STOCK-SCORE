import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { UniqueValue } from './useColumnUniqueValues';

export type FilterOperator = 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual' | 'contains';

export interface ColumnFilter {
  columnKey: string;
  type: 'values' | 'condition' | 'none';
  selectedValues?: (string | number | boolean | null)[];
  conditionOperator?: FilterOperator;
  conditionValue?: string | number;
}

export interface ColumnFilters {
  [columnKey: string]: ColumnFilter;
}

interface UseColumnFiltersOptions<T> {
  data: T[];
  tableId: string;
  onFiltersChange?: (filters: ColumnFilters) => void;
}

interface UseColumnFiltersReturn<T> {
  filters: ColumnFilters;
  setColumnFilter: (columnKey: string, filter: ColumnFilter | null) => void;
  clearColumnFilter: (columnKey: string) => void;
  clearAllFilters: () => void;
  hasActiveFilter: (columnKey: string) => boolean;
  hasAnyActiveFilter: () => boolean;
  getColumnUniqueValues: (columnKey: string) => UniqueValue[];
  filteredData: T[];
}

const STORAGE_KEY_PREFIX = 'columnFilters:';

/**
 * Custom hook for managing column-specific filters
 * 
 * Provides functionality to:
 * - Set and clear filters per column
 * - Filter data based on column filters
 * - Persist filters to localStorage
 * - Support value-based and condition-based filtering
 * 
 * @template T - Type of data items
 * @param options - Hook options
 * @returns Filter management functions and filtered data
 */
export function useColumnFilters<T extends Record<string, unknown>>({
  data,
  tableId,
  onFiltersChange,
}: UseColumnFiltersOptions<T>): UseColumnFiltersReturn<T> {
  const storageKey = `${STORAGE_KEY_PREFIX}${tableId}`;
  
  // Load filters from localStorage on mount
  const [filters, setFilters] = useState<ColumnFilters>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading column filters from localStorage:', error);
    }
    return {};
  });

  // Save filters to localStorage whenever they change
  useEffect(() => {
    try {
      if (Object.keys(filters).length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(filters));
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch (error) {
      console.error('Error saving column filters to localStorage:', error);
    }
  }, [filters, storageKey]);

  // Notify parent of filter changes
  useEffect(() => {
    if (onFiltersChange) {
      onFiltersChange(filters);
    }
  }, [filters, onFiltersChange]);

  const setColumnFilter = useCallback((columnKey: string, filter: ColumnFilter | null) => {
    setFilters((prev) => {
      const newFilters = { ...prev };
      if (filter && filter.type !== 'none') {
        newFilters[columnKey] = filter;
      } else {
        delete newFilters[columnKey];
      }
      return newFilters;
    });
  }, []);

  const clearColumnFilter = useCallback((columnKey: string) => {
    setColumnFilter(columnKey, null);
  }, [setColumnFilter]);

  const clearAllFilters = useCallback(() => {
    setFilters({});
  }, []);

  const hasActiveFilter = useCallback((columnKey: string): boolean => {
    const filter = filters[columnKey];
    if (!filter || filter.type === 'none') return false;
    
    if (filter.type === 'values') {
      return filter.selectedValues !== undefined && filter.selectedValues.length > 0;
    }
    
    if (filter.type === 'condition') {
      return filter.conditionValue !== undefined && filter.conditionValue !== null && filter.conditionValue !== '';
    }
    
    return false;
  }, [filters]);

  const hasAnyActiveFilter = useCallback((): boolean => {
    return Object.keys(filters).some((key) => hasActiveFilter(key));
  }, [filters, hasActiveFilter]);

  // Get unique values for a column
  // Note: We can't call hooks conditionally, so we'll compute values on-demand
  // and cache them manually
  const uniqueValuesCacheRef = useRef<Map<string, UniqueValue[]>>(new Map());
  
  // Update cache when data changes
  useEffect(() => {
    uniqueValuesCacheRef.current.clear();
  }, [data]);

  const getColumnUniqueValues = useCallback((columnKey: string): UniqueValue[] => {
    // Compute unique values manually (can't use hook here)
    if (!data || data.length === 0 || !columnKey) {
      return [];
    }

    // Check cache first
    if (uniqueValuesCacheRef.current.has(columnKey)) {
      return uniqueValuesCacheRef.current.get(columnKey)!;
    }

    // Count occurrences of each value
    const valueCounts = new Map<string | number | boolean | null, number>();
    
    data.forEach((item) => {
      const value = item[columnKey];
      const normalizedValue = value === null || value === undefined ? null : value;
      const currentCount = valueCounts.get(normalizedValue) || 0;
      valueCounts.set(normalizedValue, currentCount + 1);
    });

    // Convert to array of UniqueValue objects
    const uniqueValues: UniqueValue[] = Array.from(valueCounts.entries()).map(([value, count]) => {
      let displayValue: string;
      
      if (value === null || value === undefined) {
        displayValue = '(Tomma)';
      } else if (typeof value === 'boolean') {
        displayValue = value ? 'Ja' : 'Nej';
      } else if (typeof value === 'number') {
        displayValue = value.toString();
      } else {
        displayValue = String(value).trim() || '(Tomma)';
      }

      return {
        value,
        count,
        displayValue,
      };
    });

    // Sort: null values last, then by type and value
    uniqueValues.sort((a, b) => {
      // Null values go to the end
      if (a.value === null && b.value !== null) return 1;
      if (a.value !== null && b.value === null) return -1;
      if (a.value === null && b.value === null) return 0;

      // Sort by type: numbers first, then strings, then booleans
      const aType = typeof a.value;
      const bType = typeof b.value;
      
      if (aType === 'number' && bType === 'string') return -1;
      if (aType === 'string' && bType === 'number') return 1;
      if (aType === 'boolean' && bType !== 'boolean') return 1;
      if (aType !== 'boolean' && bType === 'boolean') return -1;

      // Same type: sort by value
      if (aType === 'number' && bType === 'number') {
        return (a.value as number) - (b.value as number);
      }
      
      if (aType === 'string' && bType === 'string') {
        return a.displayValue.localeCompare(b.displayValue, 'sv', { sensitivity: 'base' });
      }
      
      if (aType === 'boolean' && bType === 'boolean') {
        return (a.value === b.value) ? 0 : (a.value ? 1 : -1);
      }

      return 0;
    });

    // Cache the result
    uniqueValuesCacheRef.current.set(columnKey, uniqueValues);
    return uniqueValues;
  }, [data]);

  // Filter data based on column filters
  const filteredData = useMemo(() => {
    if (Object.keys(filters).length === 0) {
      return data;
    }

    return data.filter((item) => {
      return Object.entries(filters).every(([columnKey, filter]) => {
        if (filter.type === 'none') return true;

        const itemValue = item[columnKey];

        // Value-based filtering
        if (filter.type === 'values' && filter.selectedValues !== undefined) {
          if (filter.selectedValues.length === 0) return true;
          
          // Handle null values
          if (itemValue === null || itemValue === undefined) {
            return filter.selectedValues.includes(null);
          }
          
          // Check if item value is in selected values
          return filter.selectedValues.some((selectedValue) => {
            if (selectedValue === null) return itemValue === null || itemValue === undefined;
            
            // Type-aware comparison
            if (typeof itemValue === 'number' && typeof selectedValue === 'number') {
              return itemValue === selectedValue;
            }
            if (typeof itemValue === 'boolean' && typeof selectedValue === 'boolean') {
              return itemValue === selectedValue;
            }
            // String comparison (case-insensitive)
            return String(itemValue).toLowerCase() === String(selectedValue).toLowerCase();
          });
        }

        // Condition-based filtering
        if (filter.type === 'condition' && filter.conditionOperator && filter.conditionValue !== undefined && filter.conditionValue !== null && filter.conditionValue !== '') {
          if (itemValue === null || itemValue === undefined) {
            // Null values don't match any condition except "not equals"
            return filter.conditionOperator === 'notEquals';
          }

          const itemValueStr = String(itemValue);
          const itemValueNum = typeof itemValue === 'number' ? itemValue : parseFloat(itemValueStr);
          const conditionValueStr = String(filter.conditionValue);
          const conditionValueNum = typeof filter.conditionValue === 'number' ? filter.conditionValue : parseFloat(conditionValueStr);

          switch (filter.conditionOperator) {
            case 'equals':
              return itemValueStr.toLowerCase() === conditionValueStr.toLowerCase();
            case 'notEquals':
              return itemValueStr.toLowerCase() !== conditionValueStr.toLowerCase();
            case 'greaterThan':
              return !isNaN(itemValueNum) && !isNaN(conditionValueNum) && itemValueNum > conditionValueNum;
            case 'lessThan':
              return !isNaN(itemValueNum) && !isNaN(conditionValueNum) && itemValueNum < conditionValueNum;
            case 'greaterThanOrEqual':
              return !isNaN(itemValueNum) && !isNaN(conditionValueNum) && itemValueNum >= conditionValueNum;
            case 'lessThanOrEqual':
              return !isNaN(itemValueNum) && !isNaN(conditionValueNum) && itemValueNum <= conditionValueNum;
            case 'contains':
              return itemValueStr.toLowerCase().includes(conditionValueStr.toLowerCase());
            default:
              return true;
          }
        }

        return true;
      });
    });
  }, [data, filters]);

  return {
    filters,
    setColumnFilter,
    clearColumnFilter,
    clearAllFilters,
    hasActiveFilter,
    hasAnyActiveFilter,
    getColumnUniqueValues,
    filteredData,
  };
}
