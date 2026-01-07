import { ReactNode, useRef, useEffect, useState } from 'react';

interface VirtualScrollTableProps<T> {
  data: T[];
  renderRow: (item: T, index: number, globalIndex: number) => ReactNode;
  rowHeight?: number;
  containerHeight?: number;
  overscan?: number;
  headerHeight?: number;
  className?: string;
  onScroll?: (scrollTop: number) => void;
}

export default function VirtualScrollTable<T>({
  data,
  renderRow,
  rowHeight = 60,
  containerHeight,
  overscan = 5,
  headerHeight = 48,
  className = '',
  onScroll,
}: VirtualScrollTableProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 });
  const [containerSize, setContainerSize] = useState({ height: containerHeight || 600, width: 0 });
  const scrollTopRef = useRef(0);

  // Measure container size
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({
          height: containerHeight || rect.height || 600,
          width: rect.width,
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [containerHeight]);

  // Calculate visible range
  useEffect(() => {
    if (!containerRef.current) return;

    const calculateVisibleRange = () => {
      const scrollTop = scrollTopRef.current;
      const visibleHeight = containerSize.height - headerHeight;
      const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
      const end = Math.min(
        data.length,
        Math.ceil((scrollTop + visibleHeight) / rowHeight) + overscan
      );
      setVisibleRange({ start, end });
    };

    calculateVisibleRange();
  }, [data.length, rowHeight, containerSize.height, headerHeight, overscan]);

  // Handle scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    scrollTopRef.current = scrollTop;
    
    const visibleHeight = containerSize.height - headerHeight;
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const end = Math.min(
      data.length,
      Math.ceil((scrollTop + visibleHeight) / rowHeight) + overscan
    );
    setVisibleRange({ start, end });

    if (onScroll) {
      onScroll(scrollTop);
    }
  };

  const totalHeight = data.length * rowHeight;
  const offsetY = visibleRange.start * rowHeight;
  const visibleItems = data.slice(visibleRange.start, visibleRange.end);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-auto ${className}`}
      style={{ height: containerSize.height }}
      onScroll={handleScroll}
    >
      {/* Spacer for items before visible range */}
      <div style={{ height: offsetY }} />

      {/* Visible items */}
      <div style={{ position: 'relative' }}>
        {visibleItems.map((item, index) => {
          const globalIndex = visibleRange.start + index;
          return (
            <div
              key={globalIndex}
              style={{
                height: rowHeight,
                position: 'relative',
              }}
            >
              {renderRow(item, index, globalIndex)}
            </div>
          );
        })}
      </div>

      {/* Spacer for items after visible range */}
      <div style={{ height: Math.max(0, totalHeight - (visibleRange.end * rowHeight)) }} />
    </div>
  );
}

