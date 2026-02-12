import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDebounce } from '../hooks/useDebounce';
import { ColumnFilter, FilterOperator } from '../hooks/useColumnFilters';
import { UniqueValue } from '../hooks/useColumnUniqueValues';
import { SortConfig } from '../hooks/useTableSort';

interface ColumnFilterMenuProps<T> {
  columnKey: string;
  columnLabel: string;
  isOpen: boolean;
  onClose: () => void;
  filter: ColumnFilter | undefined;
  onFilterChange: (filter: ColumnFilter | null) => void;
  sortConfig: SortConfig<T>;
  onSort: (key: string, direction: 'asc' | 'desc') => void;
  uniqueValues: UniqueValue[];
  triggerRef?: React.RefObject<HTMLElement>;
}

const FILTER_OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: 'equals', label: 'Lika med' },
  { value: 'notEquals', label: 'Inte lika med' },
  { value: 'greaterThan', label: 'Större än' },
  { value: 'lessThan', label: 'Mindre än' },
  { value: 'greaterThanOrEqual', label: 'Större än eller lika med' },
  { value: 'lessThanOrEqual', label: 'Mindre än eller lika med' },
  { value: 'contains', label: 'Innehåller' },
];

export default function ColumnFilterMenu<T extends Record<string, unknown>>({
  columnKey,
  columnLabel,
  isOpen,
  onClose,
  filter,
  onFilterChange,
  sortConfig,
  onSort,
  uniqueValues,
  triggerRef,
}: ColumnFilterMenuProps<T>) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  const [searchValue, setSearchValue] = useState('');
  const [showValueFilter, setShowValueFilter] = useState(false);
  const [showConditionFilter, setShowConditionFilter] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; flipped: boolean }>({ top: 0, left: 0, flipped: false });
  const debouncedSearchValue = useDebounce(searchValue, 300);

  // Calculate menu position based on trigger element
  useEffect(() => {
    if (isOpen && triggerRef?.current) {
      const calculatePosition = () => {
        if (!triggerRef.current) return;
        
        const triggerRect = triggerRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        
        // Get menu dimensions (use estimated height if not yet rendered)
        const menuWidth = 256; // w-64 = 256px
        const estimatedMenuHeight = 500; // max-h-[500px]
        const actualMenuHeight = menuRef.current?.getBoundingClientRect().height || estimatedMenuHeight;
        
        // Default: position below trigger
        let top = triggerRect.bottom + 4; // 4px gap (mt-1 equivalent)
        let left = triggerRect.left;
        let flipped = false;
        
        // Check if menu would extend below viewport
        const spaceBelow = viewportHeight - triggerRect.bottom;
        const spaceAbove = triggerRect.top;
        
        // If not enough space below but more space above, flip upward
        if (spaceBelow < actualMenuHeight && spaceAbove > spaceBelow) {
          top = triggerRect.top - actualMenuHeight - 4;
          flipped = true;
        }
        
        // Ensure menu doesn't go off-screen horizontally
        if (left + menuWidth > viewportWidth) {
          left = viewportWidth - menuWidth - 8; // 8px margin from edge
        }
        if (left < 8) {
          left = 8; // 8px margin from edge
        }
        
        setMenuPosition({ top, left, flipped });
      };
      
      // Calculate position after a brief delay to ensure menu is rendered
      const timeoutId = setTimeout(() => {
        calculatePosition();
      }, 0);
      
      // Also calculate on next frame to get accurate dimensions
      requestAnimationFrame(() => {
        calculatePosition();
      });
      
      // Recalculate on scroll (for sticky headers)
      const handleScroll = () => {
        calculatePosition();
      };
      
      // Recalculate on window resize
      const handleResize = () => {
        calculatePosition();
      };
      
      window.addEventListener('scroll', handleScroll, true); // Use capture to catch all scrolls
      window.addEventListener('resize', handleResize);
      
      return () => {
        clearTimeout(timeoutId);
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [isOpen, triggerRef, showValueFilter, showConditionFilter]); // Recalculate when filter sections expand/collapse

  // Reset state when menu closes
  useEffect(() => {
    if (!isOpen) {
      setSearchValue('');
      setShowValueFilter(false);
      setShowConditionFilter(false);
    }
  }, [isOpen]);

  // Click outside handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        triggerRef?.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen, onClose, triggerRef]);

  // Escape key handler
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen, onClose]);

  // Filter unique values based on search
  const filteredValues = React.useMemo(() => {
    if (!debouncedSearchValue.trim()) {
      return uniqueValues;
    }
    const searchLower = debouncedSearchValue.toLowerCase();
    return uniqueValues.filter((uv) =>
      uv.displayValue.toLowerCase().includes(searchLower)
    );
  }, [uniqueValues, debouncedSearchValue]);

  // Get selected values for value filter
  const selectedValues = filter?.type === 'values' ? filter.selectedValues || [] : [];

  // Handle value selection toggle
  const handleValueToggle = useCallback((value: string | number | boolean | null) => {
    const currentValues = selectedValues;
    const isSelected = currentValues.some((v) => {
      if (v === null && value === null) return true;
      if (v === null || value === null) return false;
      return String(v).toLowerCase() === String(value).toLowerCase();
    });

    let newValues: (string | number | boolean | null)[];
    if (isSelected) {
      newValues = currentValues.filter((v) => {
        if (v === null && value === null) return false;
        if (v === null || value === null) return true;
        return String(v).toLowerCase() !== String(value).toLowerCase();
      });
    } else {
      newValues = [...currentValues, value];
    }

    if (newValues.length === 0) {
      onFilterChange(null);
    } else {
      onFilterChange({
        columnKey,
        type: 'values',
        selectedValues: newValues,
      });
    }
  }, [selectedValues, columnKey, onFilterChange]);

  // Handle select all / clear all
  const handleSelectAll = useCallback(() => {
    if (selectedValues.length === filteredValues.length) {
      // Clear all
      onFilterChange(null);
    } else {
      // Select all
      onFilterChange({
        columnKey,
        type: 'values',
        selectedValues: filteredValues.map((uv) => uv.value),
      });
    }
  }, [selectedValues.length, filteredValues, columnKey, onFilterChange]);

  // Handle condition filter change
  const handleConditionChange = useCallback((operator: FilterOperator, value: string | number) => {
    if (value === '' || value === null || value === undefined) {
      onFilterChange(null);
    } else {
      onFilterChange({
        columnKey,
        type: 'condition',
        conditionOperator: operator,
        conditionValue: value,
      });
    }
  }, [columnKey, onFilterChange]);

  // Handle sort
  const handleSort = useCallback((direction: 'asc' | 'desc') => {
    onSort(columnKey, direction);
    onClose();
  }, [columnKey, onSort, onClose]);

  // Clear filter
  const handleClearFilter = useCallback(() => {
    onFilterChange(null);
  }, [onFilterChange]);

  const isColumnSorted = sortConfig.key === columnKey;
  const hasActiveFilter = filter && filter.type !== 'none';

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="fixed w-64 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-500 z-[100] max-h-[500px] overflow-hidden flex flex-col animate-fade-in-up transition-all duration-200"
      style={{ 
        top: `${menuPosition.top}px`,
        left: `${menuPosition.left}px`
      }}
      role="menu"
      aria-label={`Filter och sortering för ${columnLabel}`}
    >
      {/* Sort Section */}
      <div className="border-b border-gray-200 dark:border-gray-500">
        <div className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
          Sortera
        </div>
        <button
          onClick={() => handleSort('asc')}
          className={`w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between ${
            isColumnSorted && sortConfig.direction === 'asc' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : ''
          }`}
          role="menuitem"
        >
          <span>Sortera A till Ö</span>
          {isColumnSorted && sortConfig.direction === 'asc' && (
            <span className="text-blue-600 dark:text-blue-400">✓</span>
          )}
        </button>
        <button
          onClick={() => handleSort('desc')}
          className={`w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between ${
            isColumnSorted && sortConfig.direction === 'desc' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : ''
          }`}
          role="menuitem"
        >
          <span>Sortera Ö till A</span>
          {isColumnSorted && sortConfig.direction === 'desc' && (
            <span className="text-blue-600 dark:text-blue-400">✓</span>
          )}
        </button>
        <button
          onClick={() => {}}
          className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors opacity-50 cursor-not-allowed"
          role="menuitem"
          disabled
        >
          Sortera efter färg
        </button>
      </div>

      {/* Filter Section */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-500">
          Filtrera
        </div>

        {/* Filter by values */}
        <div>
          <button
            onClick={() => setShowValueFilter(!showValueFilter)}
            className={`w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between ${
              filter?.type === 'values' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : ''
            }`}
            role="menuitem"
          >
            <span>Filtrera efter värden</span>
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${showValueFilter ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {showValueFilter && (
            <div className="border-t border-gray-200 dark:border-gray-500 bg-gray-50 dark:bg-gray-900/50">
              {/* Search input */}
              <div className="p-2">
                <input
                  type="text"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder="Sök värden..."
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {/* Select all / Clear */}
              <div className="px-2 pb-2">
                <button
                  onClick={handleSelectAll}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {selectedValues.length === filteredValues.length
                    ? 'Rensa alla'
                    : `Markera alla ${filteredValues.length}`}
                </button>
              </div>

              {/* Value list with checkboxes */}
              <div className="max-h-64 overflow-y-auto border-t border-gray-200 dark:border-gray-500">
                {filteredValues.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 text-center">
                    Inga värden hittades
                  </div>
                ) : (
                  filteredValues.map((uniqueValue) => {
                    const isSelected = selectedValues.some((v) => {
                      if (v === null && uniqueValue.value === null) return true;
                      if (v === null || uniqueValue.value === null) return false;
                      return String(v).toLowerCase() === String(uniqueValue.value).toLowerCase();
                    });

                    return (
                      <label
                        key={`${uniqueValue.value}-${uniqueValue.count}`}
                        className="flex items-center px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleValueToggle(uniqueValue.value)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300 flex-1">
                          {uniqueValue.displayValue}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          ({uniqueValue.count})
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Filter by condition */}
        <div>
          <button
            onClick={() => setShowConditionFilter(!showConditionFilter)}
            className={`w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between ${
              filter?.type === 'condition' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : ''
            }`}
            role="menuitem"
          >
            <span>Filtrera efter villkor</span>
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${showConditionFilter ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {showConditionFilter && (
            <div className="border-t border-gray-200 dark:border-gray-500 bg-gray-50 dark:bg-gray-900/50 p-2 space-y-2">
              <select
                value={filter?.type === 'condition' ? filter.conditionOperator || 'equals' : 'equals'}
                onChange={(e) => {
                  const operator = e.target.value as FilterOperator;
                  const currentValue = filter?.type === 'condition' ? filter.conditionValue : '';
                  if (currentValue !== undefined && currentValue !== null && currentValue !== '') {
                    handleConditionChange(operator, currentValue);
                  }
                }}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                onClick={(e) => e.stopPropagation()}
              >
                {FILTER_OPERATORS.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={filter?.type === 'condition' ? String(filter.conditionValue || '') : ''}
                onChange={(e) => {
                  const operator = filter?.type === 'condition' ? filter.conditionOperator || 'equals' : 'equals';
                  handleConditionChange(operator, e.target.value);
                }}
                placeholder="Värde..."
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
        </div>

        {/* Filter by color (disabled for now) */}
        <button
          onClick={() => {}}
          className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors opacity-50 cursor-not-allowed"
          role="menuitem"
          disabled
        >
          Filtrera efter färg
        </button>
      </div>

      {/* Footer with clear button */}
      {hasActiveFilter && (
        <div className="border-t border-gray-200 dark:border-gray-500 p-2">
          <button
            onClick={handleClearFilter}
            className="w-full px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
          >
            Rensa filter
          </button>
        </div>
      )}
    </div>
  );
}
