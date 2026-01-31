import { useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';

export interface ColumnConfig {
  key: string;
  label: string;
  defaultVisible?: boolean;
  required?: boolean; // Required columns cannot be hidden
}

interface UseColumnVisibilityProps {
  tableId: string;
  columns: ColumnConfig[];
}

export function useColumnVisibility({ tableId, columns }: UseColumnVisibilityProps) {
  const storageKey = `columnVisibility_${tableId}`;

  // Initialize visibility state from localStorage or defaults
  const getInitialVisibility = useCallback(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge saved state with current columns (in case columns changed)
        const visibility: Record<string, boolean> = {};
        columns.forEach(col => {
          visibility[col.key] = parsed[col.key] !== undefined 
            ? parsed[col.key] 
            : (col.defaultVisible !== false);
        });
        if (tableId === 'personal-portfolio') {
          visibility['currency'] = false;
          visibility['currentPrice'] = false;
        }
        return visibility;
      }
    } catch (error) {
      logger.error('Error loading column visibility', error, { component: 'useColumnVisibility', operation: 'loadVisibility' });
    }
    
    // Default: all columns visible except those explicitly set to defaultVisible: false
    const visibility: Record<string, boolean> = {};
    columns.forEach(col => {
      visibility[col.key] = col.defaultVisible !== false;
    });
    if (tableId === 'personal-portfolio') {
      visibility['currency'] = false;
      visibility['currentPrice'] = false;
    }
    return visibility;
  }, [storageKey, tableId, columns]);

  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(getInitialVisibility);

  // Save to localStorage whenever visibility changes
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(columnVisibility));
    } catch (error) {
      logger.error('Error saving column visibility', error, { component: 'useColumnVisibility', operation: 'saveVisibility' });
    }
  }, [storageKey, columnVisibility]);

  const toggleColumn = useCallback((columnKey: string) => {
    setColumnVisibility(prev => {
      const column = columns.find(col => col.key === columnKey);
      // Don't allow hiding required columns
      if (column?.required) {
        return prev;
      }
      return {
        ...prev,
        [columnKey]: !prev[columnKey],
      };
    });
  }, [columns]);

  const showAllColumns = useCallback(() => {
    const visibility: Record<string, boolean> = {};
    columns.forEach(col => {
      visibility[col.key] = true;
    });
    setColumnVisibility(visibility);
  }, [columns]);

  const hideAllColumns = useCallback(() => {
    const visibility: Record<string, boolean> = {};
    columns.forEach(col => {
      visibility[col.key] = col.required ? true : false;
    });
    setColumnVisibility(visibility);
  }, [columns]);

  const resetToDefaults = useCallback(() => {
    setColumnVisibility(getInitialVisibility());
  }, [getInitialVisibility]);

  const isColumnVisible = useCallback((columnKey: string) => {
    return columnVisibility[columnKey] !== false;
  }, [columnVisibility]);

  return {
    columnVisibility,
    toggleColumn,
    showAllColumns,
    hideAllColumns,
    resetToDefaults,
    isColumnVisible,
  };
}

