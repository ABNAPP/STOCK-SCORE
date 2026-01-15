import { useState, useEffect, useRef, useMemo } from 'react';

interface UseVirtualScrollOptions {
  itemHeight: number;
  containerHeight: number;
  totalItems: number;
  overscan?: number;
}

/**
 * Custom hook for virtual scrolling optimization
 * 
 * Implements virtual scrolling to efficiently render large lists by only
 * rendering visible items plus an overscan buffer. This dramatically improves
 * performance for tables with hundreds or thousands of rows.
 * 
 * **Virtual Scrolling Algorithm:**
 * - Calculates which items are visible based on scroll position
 * - Only renders visible items + overscan buffer (default: 5 items above/below)
 * - Uses fixed item height for efficient calculations
 * - Provides offset for positioning rendered items
 * 
 * **Why overscan?**
 * - Prevents flickering when scrolling quickly
 * - Ensures smooth scrolling experience
 * - Default: 5 items above and below viewport
 * 
 * @param options - Virtual scroll options
 * @param options.itemHeight - Height of each item in pixels (must be fixed)
 * @param options.containerHeight - Height of scrollable container in pixels
 * @param options.totalItems - Total number of items in the list
 * @param options.overscan - Number of items to render outside viewport (default: 5)
 * @returns Object with container ref, virtual items info, and scroll position
 * 
 * @example
 * ```typescript
 * const { containerRef, virtualItems, scrollTop } = useVirtualScroll({
 *   itemHeight: 50,
 *   containerHeight: 600,
 *   totalItems: 1000,
 *   overscan: 5
 * });
 * 
 * // Render only visible items:
 * const visibleItems = data.slice(
 *   virtualItems.startIndex,
 *   virtualItems.endIndex
 * );
 * ```
 */
export function useVirtualScroll({
  itemHeight,
  containerHeight,
  totalItems,
  overscan = 5,
}: UseVirtualScrollOptions) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollTop(container.scrollTop);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const virtualItems = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + overscan * 2,
      totalItems
    );
    const visibleStartIndex = Math.max(0, startIndex - overscan);

    return {
      startIndex: visibleStartIndex,
      endIndex,
      totalHeight: totalItems * itemHeight,
      offsetY: visibleStartIndex * itemHeight,
    };
  }, [scrollTop, itemHeight, containerHeight, totalItems, overscan]);

  return {
    containerRef,
    virtualItems,
    scrollTop,
  };
}

