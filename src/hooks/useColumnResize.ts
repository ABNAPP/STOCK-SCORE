import { useState, useCallback, useEffect, useRef } from 'react';

export interface ColumnWidths {
  [columnKey: string]: number;
}

export interface UseColumnResizeOptions {
  tableId: string;
  columns: Array<{ key: string }>;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
}

/**
 * Hook for managing column resizing in tables
 * 
 * Features:
 * - Drag to resize column headers
 * - Min/max width constraints
 * - Visual feedback during resize
 * 
 * @param options Configuration options
 * @returns Column widths state and resize handlers
 */
export function useColumnResize({
  tableId,
  columns,
  defaultWidth = 150,
  minWidth = 80,
  maxWidth = 500,
}: UseColumnResizeOptions) {
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>({});
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const resizeRef = useRef<{ columnKey: string; startX: number; startWidth: number } | null>(null);

  // Get width for a specific column
  const getColumnWidth = useCallback(
    (columnKey: string): number => {
      return columnWidths[columnKey] || defaultWidth;
    },
    [columnWidths, defaultWidth]
  );

  // Handle mouse down on resize handle
  const handleResizeStart = useCallback(
    (columnKey: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      const currentWidth = getColumnWidth(columnKey);
      setResizingColumn(columnKey);
      setResizeStartX(e.clientX);
      setResizeStartWidth(currentWidth);
      
      resizeRef.current = {
        columnKey,
        startX: e.clientX,
        startWidth: currentWidth,
      };

      // Add global mouse event listeners
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [getColumnWidth]
  );

  // Handle mouse move during resize
  const handleResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!resizeRef.current) return;

      const { columnKey, startX, startWidth } = resizeRef.current;
      const deltaX = e.clientX - startX;
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + deltaX));

      setColumnWidths((prev) => ({
        ...prev,
        [columnKey]: newWidth,
      }));
    },
    [minWidth, maxWidth]
  );

  // Handle mouse up to end resize
  const handleResizeEnd = useCallback(() => {
    setResizingColumn(null);
    resizeRef.current = null;
    
      // Remove global event listeners
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
  }, [handleResizeMove]);

  // Reset all column widths to default
  const resetWidths = useCallback(() => {
    setColumnWidths({});
  }, []);

  // Set width for a specific column programmatically
  const setColumnWidth = useCallback(
    (columnKey: string, width: number) => {
      const constrainedWidth = Math.max(minWidth, Math.min(maxWidth, width));
      setColumnWidths((prev) => ({
        ...prev,
        [columnKey]: constrainedWidth,
      }));
    },
    [minWidth, maxWidth]
  );

  return {
    columnWidths,
    resizingColumn,
    getColumnWidth,
    handleResizeStart,
    resetWidths,
    setColumnWidth,
  };
}
