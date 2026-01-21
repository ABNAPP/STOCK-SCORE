import { useMemo } from 'react';

export interface UniqueValue {
  value: string | number | boolean | null;
  count: number;
  displayValue: string;
}

/**
 * Custom hook to extract unique values from a specific column in a dataset
 * 
 * Extracts unique values from a column, counts occurrences, and returns them
 * sorted with display-friendly formatting.
 * 
 * @template T - Type of data items
 * @param data - Array of data items
 * @param columnKey - Key of the column to extract values from
 * @returns Array of unique values with counts, sorted alphabetically/numerically
 */
export function useColumnUniqueValues<T extends Record<string, unknown>>(
  data: T[],
  columnKey: string
): UniqueValue[] {
  return useMemo(() => {
    if (!data || data.length === 0 || !columnKey) {
      return [];
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

    return uniqueValues;
  }, [data, columnKey]);
}
