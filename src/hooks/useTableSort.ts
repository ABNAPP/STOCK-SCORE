import { useState, useMemo } from 'react';

export type SortDirection = 'asc' | 'desc';
export type SortConfig<T> = {
  key: keyof T | null;
  direction: SortDirection;
};

// Helper function to check if a value represents N/A
function isNAValue(value: any, key: string | number | symbol): boolean {
  if (value == null) return true;
  
  // String values: 'N/A' means N/A
  if (typeof value === 'string' && value.trim().toUpperCase() === 'N/A') return true;
  
  // For numeric values where 0 means N/A (except 'score' which can be 0)
  // This is a heuristic: we'll treat 0 as N/A for numeric columns except 'score'
  // For BenjaminGrahamData: price and benjaminGraham can have 0 = N/A
  // For Stock: score 0 is valid, so we exclude it
  if (typeof value === 'number' && value === 0 && String(key) !== 'score') {
    return true;
  }
  
  return false;
}

export function useTableSort<T>(
  data: T[],
  defaultSortKey: keyof T,
  defaultDirection: SortDirection = 'asc'
) {
  const [sortConfig, setSortConfig] = useState<SortConfig<T>>({
    key: defaultSortKey,
    direction: defaultDirection,
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
      const keys = Object.keys(item) as Array<keyof T>;
      
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
    const isThresholdIndustryData = data.length > 0 && 'industry' in data[0];
    
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
    const sortedRegular = [...regularItems].sort((a, b) => {
      const aValue = a[sortConfig.key!];
      const bValue = b[sortConfig.key!];

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
