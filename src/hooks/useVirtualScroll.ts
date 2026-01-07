import { useState, useEffect, useRef, useMemo } from 'react';

interface UseVirtualScrollOptions {
  itemHeight: number;
  containerHeight: number;
  totalItems: number;
  overscan?: number;
}

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

