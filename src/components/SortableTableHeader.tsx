import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableTableHeaderProps {
  id: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  isResizing?: boolean;
  enableResize?: boolean;
  onResizeStart?: (e: React.MouseEvent) => void;
}

export function SortableTableHeader({
  id,
  children,
  className = '',
  style,
  isResizing = false,
  enableResize = false,
  onResizeStart,
}: SortableTableHeaderProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <th
      ref={setNodeRef}
      style={{ ...style, ...dragStyle }}
      className={`${className} ${isDragging ? 'z-50' : ''} ${isResizing ? 'bg-blue-100 dark:bg-blue-900/50' : ''}`}
      {...attributes}
    >
      <div className="flex items-center justify-between relative">
        <div
          {...listeners}
          className="flex-1 flex items-center cursor-grab active:cursor-grabbing"
          style={{ touchAction: 'none' }}
        >
          {children}
        </div>
        {enableResize && (
          <div
            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 dark:hover:bg-blue-400 transition-colors duration-base"
            onMouseDown={(e) => {
              e.stopPropagation();
              if (onResizeStart) {
                onResizeStart(e);
              }
            }}
            role="separator"
            aria-orientation="vertical"
          />
        )}
      </div>
    </th>
  );
}
