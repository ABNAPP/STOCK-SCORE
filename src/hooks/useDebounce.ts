import { useState, useEffect } from 'react';

/**
 * Custom hook for debouncing a value
 * 
 * Delays updating the value until the user stops making changes for the
 * specified delay period. Useful for reducing API calls during search input
 * or other frequent updates.
 * 
 * **Debounce Strategy:**
 * - Waits for delay period of inactivity before updating
 * - Cancels previous timer if value changes before delay completes
 * - Default delay: 300ms (good balance between responsiveness and efficiency)
 * 
 * **Use Cases:**
 * - Search input: Reduces API calls while user is typing
 * - Filter changes: Prevents excessive filtering operations
 * - Resize handlers: Reduces calculations during window resize
 * 
 * @template T - Type of value being debounced
 * @param value - The value to debounce
 * @param delay - The delay in milliseconds (default: 300ms)
 * @returns The debounced value (updates after delay period)
 * 
 * @example
 * ```typescript
 * const [searchValue, setSearchValue] = useState('');
 * const debouncedSearch = useDebounce(searchValue, 500);
 * 
 * // debouncedSearch only updates 500ms after user stops typing
 * useEffect(() => {
 *   performSearch(debouncedSearch);
 * }, [debouncedSearch]);
 * ```
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set up a timer to update the debounced value after the delay
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clean up the timer if value changes before delay completes
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

