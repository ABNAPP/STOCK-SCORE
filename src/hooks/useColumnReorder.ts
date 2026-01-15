import { useState, useCallback, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';

export interface UseColumnReorderOptions {
  tableId: string;
  columns: Array<{ key: string }>;
  onReorder?: (newOrder: string[]) => void;
}

const STORAGE_PREFIX = 'table_column_order_';

/**
 * Hook for managing column reordering in tables using drag & drop
 * 
 * Features:
 * - Drag & drop column headers to reorder
 * - Keyboard accessibility for reordering
 * - Persist column order to localStorage per table
 * - Visual feedback during drag
 * 
 * @param options Configuration options
 * @returns Column order state and reorder handlers
 */
export function useColumnReorder({
  tableId,
  columns,
  onReorder,
}: UseColumnReorderOptions) {
  const storageKey = `${STORAGE_PREFIX}${tableId}`;
  
  // Load saved order from localStorage
  const loadSavedOrder = useCallback((): string[] => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        // Validate that all saved keys exist in current columns
        const columnKeys = columns.map((col) => col.key);
        return parsed.filter((key) => columnKeys.includes(key));
      }
    } catch (error) {
      console.warn('Failed to load column order from localStorage:', error);
    }
    return columns.map((col) => col.key);
  }, [storageKey, columns]);

  const [columnOrder, setColumnOrder] = useState<string[]>(loadSavedOrder);

  // Update order when columns change
  useEffect(() => {
    const currentKeys = columns.map((col) => col.key);
    const savedOrder = loadSavedOrder();
    
    // Merge saved order with new columns (add new columns at the end)
    const newOrder = [
      ...savedOrder.filter((key) => currentKeys.includes(key)),
      ...currentKeys.filter((key) => !savedOrder.includes(key)),
    ];
    
    setColumnOrder(newOrder);
  }, [columns, loadSavedOrder]);

  // Save order to localStorage whenever it changes
  useEffect(() => {
    try {
      if (columnOrder.length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(columnOrder));
      }
    } catch (error) {
      console.warn('Failed to save column order to localStorage:', error);
    }
  }, [columnOrder, storageKey]);

  // Configure sensors for drag & drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        setColumnOrder((items) => {
          const oldIndex = items.indexOf(active.id as string);
          const newIndex = items.indexOf(over.id as string);
          const newOrder = arrayMove(items, oldIndex, newIndex);
          
          // Call optional callback
          if (onReorder) {
            onReorder(newOrder);
          }
          
          return newOrder;
        });
      }
    },
    [onReorder]
  );

  // Get ordered columns
  const getOrderedColumns = useCallback(
    <T extends { key: string }>(cols: T[]): T[] => {
      return columnOrder
        .map((key) => cols.find((col) => col.key === key))
        .filter((col): col is T => col !== undefined)
        .concat(cols.filter((col) => !columnOrder.includes(col.key)));
    },
    [columnOrder]
  );

  // Reset to default order
  const resetOrder = useCallback(() => {
    const defaultOrder = columns.map((col) => col.key);
    setColumnOrder(defaultOrder);
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.warn('Failed to remove column order from localStorage:', error);
    }
    if (onReorder) {
      onReorder(defaultOrder);
    }
  }, [columns, storageKey, onReorder]);

  return {
    columnOrder,
    sensors,
    handleDragEnd,
    getOrderedColumns,
    resetOrder,
    DndContext,
    SortableContext,
    horizontalListSortingStrategy,
    closestCenter,
  };
}
