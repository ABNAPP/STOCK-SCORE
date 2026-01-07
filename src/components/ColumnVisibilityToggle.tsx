import React, { useState, useRef, useEffect } from 'react';
import { ColumnConfig } from '../hooks/useColumnVisibility';

interface ColumnVisibilityToggleProps {
  columns: ColumnConfig[];
  columnVisibility: Record<string, boolean>;
  onToggleColumn: (columnKey: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
  onReset: () => void;
  isColumnVisible: (columnKey: string) => boolean;
}

export default function ColumnVisibilityToggle({
  columns,
  columnVisibility,
  onToggleColumn,
  onShowAll,
  onHideAll,
  onReset,
  isColumnVisible,
}: ColumnVisibilityToggleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const visibleCount = columns.filter(col => isColumnVisible(col.key)).length;
  const totalCount = columns.length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 sm:px-3 py-3 sm:py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:shadow-md hover:scale-105 active:scale-95 flex items-center space-x-2 min-h-[44px] touch-manipulation"
        title="Välj kolumner att visa"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
        <span>Kolumner</span>
        <span className="text-xs text-gray-500 dark:text-gray-300">
          ({visibleCount}/{totalCount})
        </span>
        <svg
          className={`w-4 h-4 transition-transform duration-300 ease-in-out ${isOpen ? 'transform rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-500 z-50 max-h-96 overflow-y-auto animate-fade-in-up transition-all duration-200">
          <div className="p-3 border-b border-gray-200 dark:border-gray-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Kolumnvisning
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-all duration-200 hover:scale-110 active:scale-95 p-2 min-h-[44px] min-w-[44px] touch-manipulation flex items-center justify-center"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={onShowAll}
                className="text-xs sm:text-xs px-3 py-2 sm:px-2 sm:py-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-all duration-200 hover:scale-105 active:scale-95 min-h-[44px] sm:min-h-0 touch-manipulation inline-flex items-center gap-1.5 sm:gap-1"
              >
                <svg className="w-3.5 h-3.5 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span>Visa alla</span>
              </button>
              <button
                onClick={onHideAll}
                className="text-xs sm:text-xs px-3 py-2 sm:px-2 sm:py-1 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-all duration-200 hover:scale-105 active:scale-95 min-h-[44px] sm:min-h-0 touch-manipulation inline-flex items-center gap-1.5 sm:gap-1"
              >
                <svg className="w-3.5 h-3.5 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
                <span>Dölj alla</span>
              </button>
              <button
                onClick={onReset}
                className="text-xs sm:text-xs px-3 py-2 sm:px-2 sm:py-1 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-all duration-200 hover:scale-105 active:scale-95 min-h-[44px] sm:min-h-0 touch-manipulation inline-flex items-center gap-1.5 sm:gap-1"
              >
                <svg className="w-3.5 h-3.5 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Återställ</span>
              </button>
            </div>
          </div>
          <div className="p-2">
            {columns.map((column) => {
              const isVisible = isColumnVisible(column.key);
              const isRequired = column.required === true;

              return (
                <label
                  key={column.key}
                  className={`flex items-center px-2 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-95 ${
                    isRequired ? 'opacity-60' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={() => onToggleColumn(column.key)}
                    disabled={isRequired}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-110 cursor-pointer"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300 flex-1">
                    {column.label}
                  </span>
                  {isRequired && (
                    <span className="text-xs text-gray-500 dark:text-gray-300">(krävs)</span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

