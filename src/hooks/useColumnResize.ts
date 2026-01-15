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

const STORAGE_PREFIX = 'table_column_widths_';

/**
 * Hook for managing column resizing in tables
 * 
 * Features:
 * - Drag to resize column headers
 * - Persist widths to localStorage per table
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
  const storageKey = `${STORAGE_PREFIX}${tableId}`;
  
  // Load saved widths from localStorage
  const loadSavedWidths = useCallback((): ColumnWidths => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as ColumnWidths;
        // Validate that all saved widths are within constraints
        const validated: ColumnWidths = {};
        Object.keys(parsed).forEach((key) => {
          const width = parsed[key];
          if (typeof width === 'number' && width >= minWidth && width <= maxWidth) {
            validated[key] = width;
          }
        });
        return validated;
      }
    } catch (error) {
      console.warn('Failed to load column widths from localStorage:', error);
    }
    return {};
  }, [storageKey, minWidth, maxWidth]);

  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(loadSavedWidths);
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const resizeRef = useRef<{ columnKey: string; startX: number; startWidth: number } | null>(null);

  // Save widths to localStorage whenever they change
  useEffect(() => {
    try {
      if (Object.keys(columnWidths).length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(columnWidths));
      }
    } catch (error) {
      console.warn('Failed to save column widths to localStorage:', error);
    }
  }, [columnWidths, storageKey]);

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
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.warn('Failed to remove column widths from localStorage:', error);
    }
  }, [storageKey]);

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
