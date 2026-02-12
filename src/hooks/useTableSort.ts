import { useState, useMemo } from 'react';

export type SortDirection = 'asc' | 'desc';
export type SortConfig<T> = {
  key: keyof T | null;
  direction: SortDirection;
};

/**
 * Helper function to check if a value represents N/A
 * 
 * **Why this logic?**
 * - Business requirement: N/A values should be sorted to the end
 * - String 'N/A' explicitly means missing data
 * - Null/undefined values mean missing data
 * - Numeric 0 is a valid value and should be displayed as "0", not N/A
 */
function isNAValue(value: unknown, key: string | number | symbol): boolean {
  if (value == null) return true;
  
  // String values: 'N/A' means N/A
  if (typeof value === 'string' && value.trim().toUpperCase() === 'N/A') return true;
  
  return false;
}

/**
 * Custom hook for table sorting with N/A value handling
 * 
 * Provides sorting functionality that:
 * - Separates N/A values and places them at the end
 * - Handles different data types (numbers, strings)
 * - Supports ascending/descending sort with toggle
 * - Uses different N/A detection logic for ThresholdIndustryData vs other types
 * 
 * **N/A Handling Strategy:**
 * - **ThresholdIndustryData**: Only checks the sorted column for N/A
 * - **Other types**: Checks all numeric columns (except score and industry)
 * - N/A items are always sorted to the end, then sorted by company name
 * 
 * **Why N/A values go last?**
 * - Business requirement: Missing data should not interfere with meaningful comparisons
 * - Ensures data quality by highlighting incomplete records
 * - Provides consistent user experience across all table views
 * 
 * @template T - Type of data items being sorted
 * @param data - Array of data items to sort
 * @param defaultSortKey - Default column to sort by
 * @param defaultDirection - Default sort direction ('asc' or 'desc')
 * @returns Object with sorted data, sort configuration, and sort handler
 * 
 * @example
 * ```typescript
 * const { sortedData, sortConfig, handleSort } = useTableSort(
 *   stockData,
 *   'score',
 *   'desc'
 * );
 * 
 * // In component:
 * <button onClick={() => handleSort('price')}>
 *   Sort by Price {sortConfig.key === 'price' && sortConfig.direction}
 * </button>
 * ```
 */
export function useTableSort<T>(
  data: T[],
  defaultSortKey: keyof T,
  defaultDirection: SortDirection = 'asc',
  initialSortConfig?: { key: string; direction: 'asc' | 'desc' }
) {
  const [sortConfig, setSortConfig] = useState<SortConfig<T>>(() => {
    if (initialSortConfig) {
      return {
        key: initialSortConfig.key as keyof T,
        direction: initialSortConfig.direction,
      };
    }
    return {
      key: defaultSortKey,
      direction: defaultDirection,
    };
  });

  const sortedData = useMemo(() => {
    if (!sortConfig.key) {
      return data;
    }

    // Helper function to check if a row has N/A in the column being sorted
    // For ThresholdIndustryData: only check the sorted column, not all columns
    // For other types: check all numeric columns except score and industry
    const hasNAInSortedColumn = (item: T): boolean => {
      if (!sortConfig.key) return false;
      
      const value = item[sortConfig.key];
      const keyStr = String(sortConfig.key);
      
      // For ThresholdIndustryData, only check the sorted column itself
      // Skip industry column as it's always a valid string
      if (keyStr === 'industry') {
        return false;
      }
      
      return isNAValue(value, sortConfig.key);
    };
    
    // Helper function to check if a row has N/A in ANY column (for backward compatibility)
    // For BenjaminGrahamData: check price and benjaminGraham (0 = N/A)
    // For other types: check all numeric columns except score and industry
    const hasNAInAnyColumn = (item: T): boolean => {
      // Get all keys from the item
      // Use type guard: T must be object for Object.keys
      const keys = Object.keys(item as object) as Array<keyof T>;
      
      for (const key of keys) {
        // Skip companyName, ticker, company, ticket, and industry as they can't be N/A (filtered out already or always valid)
        if (String(key) === 'companyName' || String(key) === 'ticker' || 
            String(key) === 'company' || String(key) === 'ticket' ||
            String(key) === 'industry') {
          continue;
        }
        
        const value = item[key];
        if (isNAValue(value, key)) {
          return true;
        }
      }
      return false;
    };

    // Separate items with N/A in the sorted column from items without N/A
    // For ThresholdIndustryData, only check the sorted column
    // For other types, check all columns
    const regularItems: T[] = [];
    const naItems: T[] = [];

    // Check if this is ThresholdIndustryData by checking if 'industry' key exists
    // Type guard: ensure data[0] is an object before checking for 'industry'
    const isThresholdIndustryData = data.length > 0 && typeof data[0] === 'object' && data[0] !== null && 'industry' in data[0];
    
    data.forEach((item) => {
      // For ThresholdIndustryData, only check the sorted column
      // For other types, check all columns
      const hasNA = isThresholdIndustryData 
        ? hasNAInSortedColumn(item)
        : hasNAInAnyColumn(item);
      
      if (hasNA) {
        naItems.push(item);
      } else {
        regularItems.push(item);
      }
    });

    // Sort regular items
    // At this point, sortConfig.key is guaranteed to be non-null (checked at line 38)
    const sortKey = sortConfig.key;
    const sortedRegular = [...regularItems].sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];

      // Handle null/undefined (should not happen after N/A check, but safety)
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      // Numeric comparison
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return aValue - bValue;
      }

      // String comparison (case-insensitive)
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      
      if (aStr < bStr) return -1;
      if (aStr > bStr) return 1;
      return 0;
    });

    // Apply sort direction to regular items
    const finalSorted = sortConfig.direction === 'asc' ? sortedRegular : sortedRegular.reverse();

    // Sort N/A items by Company Name (or defaultSortKey if companyName doesn't exist)
    // Try to find 'companyName' key, otherwise use defaultSortKey
    const fallbackSortKey = ('companyName' in (data[0] || {}) ? 'companyName' : defaultSortKey) as keyof T;
    
    const sortedNAItems = [...naItems].sort((a, b) => {
      const aValue = a[fallbackSortKey];
      const bValue = b[fallbackSortKey];

      // Handle null/undefined
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      // Numeric comparison
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return aValue - bValue;
      }

      // String comparison (case-insensitive)
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      
      if (aStr < bStr) return -1;
      if (aStr > bStr) return 1;
      return 0;
    });

    // Edge case: All values are N/A
    // If all items have N/A values, they're all sorted by company name
    // This ensures consistent sorting even when no valid data exists
    // N/A items always go at the end, sorted by Company Name
    return [...finalSorted, ...sortedNAItems];
  }, [data, sortConfig, defaultSortKey]);

  const handleSort = (key: keyof T) => {
    setSortConfig((prevConfig) => {
      if (prevConfig.key === key) {
        // Toggle direction if clicking the same column
        return {
          key,
          direction: prevConfig.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      // New column, start with ascending
      return {
        key,
        direction: 'asc',
      };
    });
  };

  return {
    sortedData,
    sortConfig,
    handleSort,
  };
}
