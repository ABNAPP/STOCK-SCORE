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

/**
 * Hook for managing column reordering in tables using drag & drop
 * 
 * Features:
 * - Drag & drop column headers to reorder
 * - Keyboard accessibility for reordering
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
  const [columnOrder, setColumnOrder] = useState<string[]>(() => columns.map((col) => col.key));

  // Update order when columns change
  useEffect(() => {
    const currentKeys = columns.map((col) => col.key);
    setColumnOrder((prev) => {
      const newOrder = [
        ...prev.filter((key) => currentKeys.includes(key)),
        ...currentKeys.filter((key) => !prev.includes(key)),
      ];
      return newOrder;
    });
  }, [columns]);

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
    if (onReorder) {
      onReorder(defaultOrder);
    }
  }, [columns, onReorder]);

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
