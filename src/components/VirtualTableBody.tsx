import React, { ReactNode, useRef, useEffect, useState, useMemo, useCallback } from 'react';

interface VirtualTableBodyProps<T> {
  data: T[];
  renderRow: (item: T, index: number, globalIndex: number) => ReactNode;
  getRowKey?: (item: T, index: number) => string;
  rowHeight?: number;
  overscan?: number;
  className?: string;
}

export default function VirtualTableBody<T>({
  data,
  renderRow,
  getRowKey,
  rowHeight = 60,
  overscan = 5,
  className = '',
}: VirtualTableBodyProps<T>) {
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingScrollTopRef = useRef<number>(0);

  // Debounced scroll handler using requestAnimationFrame
  const handleScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      pendingScrollTopRef.current = scrollContainerRef.current.scrollTop;
      
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          setScrollTop(pendingScrollTopRef.current);
          rafRef.current = null;
        });
      }
    }
  }, []);

  // Find scroll container and measure dimensions
  useEffect(() => {
    if (!tbodyRef.current) return;

    // Find the scrollable container (usually a parent div with overflow-auto)
    let container = tbodyRef.current.parentElement;
    while (container) {
      const style = window.getComputedStyle(container);
      const overflow = style.overflow;
      const overflowY = style.overflowY;
      if (overflow === 'auto' || overflow === 'scroll' || overflowY === 'auto' || overflowY === 'scroll') {
        scrollContainerRef.current = container;
        break;
      }
      container = container.parentElement;
    }

    const updateDimensions = () => {
      if (scrollContainerRef.current) {
        const rect = scrollContainerRef.current.getBoundingClientRect();
        setContainerHeight(rect.height || 600);
      }
    };

    if (scrollContainerRef.current) {
      updateDimensions();
      scrollContainerRef.current.addEventListener('scroll', handleScroll, { passive: true });
      window.addEventListener('resize', updateDimensions);

      return () => {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
        }
        if (scrollContainerRef.current) {
          scrollContainerRef.current.removeEventListener('scroll', handleScroll);
        }
        window.removeEventListener('resize', updateDimensions);
      };
    }
  }, [handleScroll]);

  // Calculate visible range - memoized for performance
  const visibleRange = useMemo(() => {
    // Subtract approximate header height (48px)
    const availableHeight = Math.max(200, containerHeight - 48);
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const end = Math.min(
      data.length,
      Math.ceil((scrollTop + availableHeight) / rowHeight) + overscan
    );

    return {
      startIndex: start,
      endIndex: end,
      offsetY: start * rowHeight,
      totalHeight: data.length * rowHeight,
    };
  }, [scrollTop, rowHeight, containerHeight, data.length, overscan]);

  const { startIndex, endIndex, offsetY, totalHeight } = visibleRange;

  // Memoize visible items slice for performance
  const visibleItems = useMemo(() => {
    return data.slice(startIndex, endIndex);
  }, [data, startIndex, endIndex]);

  // Memoize renderRow callback to prevent unnecessary re-renders
  const memoizedRenderRow = useCallback((item: T, index: number, globalIndex: number) => {
    return renderRow(item, index, globalIndex);
  }, [renderRow]);

  if (data.length === 0) {
    return (
      <tbody ref={tbodyRef} className={className}>
        <tr>
          <td colSpan={100} className="text-center py-8 text-gray-600 dark:text-gray-300">
            <div className="text-sm">Inga resultat hittades.</div>
            <div className="text-xs mt-1 text-gray-600 dark:text-gray-400">
              Försök ändra dina sökkriterier eller filter.
            </div>
          </td>
        </tr>
      </tbody>
    );
  }

  return (
    <tbody ref={tbodyRef} className={className} style={{ position: 'relative' }}>
      {/* Spacer for items before visible range */}
      {offsetY > 0 && (
        <tr aria-hidden="true">
          <td
            colSpan={100}
            style={{
              height: offsetY,
              padding: 0,
              border: 'none',
              lineHeight: 0,
            }}
          />
        </tr>
      )}

      {/* Visible rows */}
      {visibleItems.map((item, relativeIndex) => {
        const globalIndex = startIndex + relativeIndex;
        const rowKey = getRowKey ? getRowKey(item, globalIndex) : String(globalIndex);
        return (
          <React.Fragment key={rowKey}>
            {memoizedRenderRow(item, relativeIndex, globalIndex)}
          </React.Fragment>
        );
      })}

      {/* Spacer for items after visible range */}
      {endIndex < data.length && (
        <tr aria-hidden="true">
          <td
            colSpan={100}
            style={{
              height: Math.max(0, totalHeight - endIndex * rowHeight),
              padding: 0,
              border: 'none',
              lineHeight: 0,
            }}
          />
        </tr>
      )}
    </tbody>
  );
}
