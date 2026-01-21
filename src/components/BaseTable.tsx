import React, { useState, useCallback, useRef, ReactNode, lazy, Suspense } from 'react';
import { useTableSort, SortConfig } from '../hooks/useTableSort';
import { useTableSearch } from '../hooks/useTableSearch';
import { useTablePagination } from '../hooks/useTablePagination';
import { useColumnVisibility, ColumnConfig } from '../hooks/useColumnVisibility';
import VirtualTableBody from './VirtualTableBody';
import { TableSkeleton } from './SkeletonLoader';
import TableSearchBar from './TableSearchBar';
import Pagination from './Pagination';
import ColumnVisibilityToggle from './ColumnVisibilityToggle';
import { FilterConfig, FilterValues } from '../types/filters';
import ShareableLinkModal from './ShareableLinkModal';
import { useTranslation } from 'react-i18next';
import { exportTableData, ExportColumn } from '../services/exportService';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import Button from './ui/Button';
import { useColumnResize } from '../hooks/useColumnResize';
import { useColumnReorder } from '../hooks/useColumnReorder';
import { SortableTableHeader } from './SortableTableHeader';
import { printTable } from '../utils/printUtils';
import { useColumnFilters, ColumnFilters, ColumnFilter } from '../hooks/useColumnFilters';
import { UniqueValue } from '../hooks/useColumnUniqueValues';
import ColumnFilterMenu from './ColumnFilterMenu';


export interface ColumnDefinition<T = unknown> extends ColumnConfig {
  sortable?: boolean;
  sticky?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
  renderHeader?: (props: HeaderRenderProps<T>) => ReactNode;
  renderCell?: (item: T, column: ColumnDefinition<T>, index: number, globalIndex: number, expandedRows?: { [key: string]: boolean }, toggleRow?: (rowKey: string) => void) => ReactNode;
}

export interface HeaderRenderProps<T = unknown> {
  column: ColumnDefinition<T>;
  sortConfig: SortConfig<T>;
  handleSort: (key: string) => void;
  getSortIcon: (columnKey: string) => string | null;
  getStickyPosition: (columnKey: string) => string;
  isColumnVisible: (columnKey: string) => boolean;
  // Column filter props
  openFilterMenuColumn: string | null;
  setOpenFilterMenuColumn: (columnKey: string | null) => void;
  hasActiveColumnFilter: (columnKey: string) => boolean;
  getColumnUniqueValues: (columnKey: string) => UniqueValue[];
  columnFilters: ColumnFilters;
  setColumnFilter: (columnKey: string, filter: ColumnFilter | null) => void;
  handleColumnSort: (columnKey: string, direction: 'asc' | 'desc') => void;
  headerRefs: React.MutableRefObject<{ [key: string]: HTMLElement | null }>;
}

export interface BaseTableProps<T> {
  // Data & state
  data: T[];
  loading: boolean;
  error: string | null;
  
  // Column configuration
  columns: ColumnDefinition<T>[];
  filters: FilterConfig[];
  tableId: string;
  
  // Rendering functions
  renderCell: (item: T, column: ColumnDefinition<T>, index: number, globalIndex: number, expandedRows?: { [key: string]: boolean }, toggleRow?: (rowKey: string) => void) => ReactNode;
  renderHeader?: (props: HeaderRenderProps<T>) => ReactNode;
  renderMobileCard?: (item: T, index: number, globalIndex: number, isExpanded: boolean, toggleExpand: () => void) => ReactNode;
  renderExpandedRow?: (item: T, index: number, globalIndex: number) => ReactNode;
  
  // Options
  enablePagination?: boolean;
  enableVirtualScroll?: boolean;
  enableHelp?: boolean;
  enableMobileExpand?: boolean;
  itemsPerPage?: number;
  virtualScrollRowHeight?: number;
  virtualScrollOverscan?: number;
  
  // Search configuration
  searchFields: (keyof T)[];
  searchPlaceholder?: string;
  
  // Sort configuration
  defaultSortKey?: keyof T;
  defaultSortDirection?: 'asc' | 'desc';
  
  // Sticky columns
  stickyColumns?: string[];
  
  // Additional props
  ariaLabel?: string;
  emptyMessage?: string;
  minTableWidth?: string;
  
  // Custom header content (for additional buttons, etc.)
  headerActions?: ReactNode;
  
  // Custom row key generator
  getRowKey?: (item: T, index: number) => string;
  
  // Export configuration
  enableExport?: boolean;
  exportFilename?: string;
  
  // Column resizing
  enableColumnResize?: boolean;
  defaultColumnWidth?: number;
  minColumnWidth?: number;
  maxColumnWidth?: number;
  
  // Column reordering
  enableColumnReorder?: boolean;
  
  // Print configuration
  enablePrint?: boolean;
  printTableName?: string;
  
  // Shareable link configuration
  enableShareableLink?: boolean;
  viewId?: string;
}

export default function BaseTable<T extends Record<string, unknown>>({
  data,
  loading,
  error,
  columns,
  filters,
  tableId,
  renderCell,
  renderHeader,
  renderMobileCard,
  renderExpandedRow,
  enablePagination = false,
  enableVirtualScroll = false,
  enableHelp = false,
  enableMobileExpand = false,
  itemsPerPage = 50,
  virtualScrollRowHeight = 60,
  virtualScrollOverscan = 10,
  searchFields,
  searchPlaceholder = 'Sök...',
  defaultSortKey,
  defaultSortDirection = 'asc',
  stickyColumns = [],
  ariaLabel,
  emptyMessage,
  minTableWidth = '600px',
  headerActions,
  getRowKey,
  enableExport = false,
  exportFilename,
  enableColumnResize = false,
  defaultColumnWidth = 150,
  minColumnWidth = 80,
  maxColumnWidth = 500,
  enableColumnReorder = false,
  enablePrint = false,
  printTableName,
  enableShareableLink = false,
  viewId,
}: BaseTableProps<T>) {
  const { t } = useTranslation();
  const { createNotification } = useNotifications();
  const { currentUser } = useAuth();
  const [filterValues, setFilterValues] = useState<FilterValues>({});
  const [shareableLinkModalOpen, setShareableLinkModalOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<{ [key: string]: boolean }>({});
  const [focusedRowIndex, setFocusedRowIndex] = useState<number | null>(null);
  const [openFilterMenuColumn, setOpenFilterMenuColumn] = useState<string | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const headerRefs = useRef<{ [key: string]: HTMLElement | null }>({});

  // Column filters hook
  const {
    filters: columnFilters,
    setColumnFilter,
    clearColumnFilter,
    hasActiveFilter: hasActiveColumnFilter,
    getColumnUniqueValues,
    filteredData: columnFilteredData,
  } = useColumnFilters<T>({
    data,
    tableId,
  });
  
  // Column visibility
  const {
    columnVisibility,
    toggleColumn,
    showAllColumns,
    hideAllColumns,
    resetToDefaults,
    isColumnVisible,
  } = useColumnVisibility({
    tableId,
    columns,
  });

  // Column resizing
  const {
    resizingColumn,
    getColumnWidth,
    handleResizeStart,
  } = useColumnResize({
    tableId,
    columns,
    defaultWidth: defaultColumnWidth,
    minWidth: minColumnWidth,
    maxWidth: maxColumnWidth,
  });

  // Column reordering
  const {
    getOrderedColumns,
    sensors,
    handleDragEnd,
    DndContext,
    SortableContext,
    horizontalListSortingStrategy,
    closestCenter,
  } = useColumnReorder({
    tableId,
    columns,
  });

  // Get columns in correct order
  const orderedColumns = enableColumnReorder ? getOrderedColumns(columns) : columns;

  // Determine which data to use: column filters replace advanced filters
  const hasColumnFilters = Object.keys(columnFilters).length > 0;
  const dataToFilter = hasColumnFilters ? columnFilteredData : data;

  // Search/filter data (only if no column filters are active)
  const { searchValue, setSearchValue, filteredData } = useTableSearch<T>({
    data: dataToFilter,
    searchFields,
    advancedFilters: hasColumnFilters ? {} : filterValues, // Don't apply advanced filters if column filters are active
  });

  // Determine final data: if column filters active, use column filtered data; otherwise use search filtered data
  const finalFilteredData = hasColumnFilters ? columnFilteredData : filteredData;

  // Sort filtered data
  const { sortedData, sortConfig, handleSort: baseHandleSort } = useTableSort(
    finalFilteredData,
    defaultSortKey || (searchFields[0] as keyof T),
    defaultSortDirection
  );

  // Handler specifically for column filter menu sort buttons
  const handleColumnSort = useCallback((columnKey: string, direction: 'asc' | 'desc') => {
    const key = columnKey as keyof T;
    // If already sorted in the desired direction, do nothing
    if (sortConfig.key === key && sortConfig.direction === direction) {
      return;
    }
    
    // If same column but different direction, toggle
    if (sortConfig.key === key) {
      baseHandleSort(key);
    } else {
      // Different column - need to set it
      // Since baseHandleSort always starts with 'asc', we call it once
      // and if we need 'desc', we'll need to call it again after state updates
      baseHandleSort(key);
      if (direction === 'desc') {
        // Use requestAnimationFrame to ensure state has updated
        requestAnimationFrame(() => {
          baseHandleSort(key);
        });
      }
    }
  }, [baseHandleSort, sortConfig]);

  // Default handleSort for column header clicks
  const handleSort = useCallback((key: keyof T) => {
    baseHandleSort(key);
  }, [baseHandleSort]);

  // Paginate sorted data (if enabled)
  const paginationResult = useTablePagination({
    data: sortedData,
    itemsPerPage: enablePagination ? itemsPerPage : sortedData.length,
  });

  const {
    currentPage,
    totalPages,
    itemsPerPage: actualItemsPerPage,
    paginatedData,
    totalItems,
    goToPage,
    nextPage,
    previousPage,
    goToFirstPage,
    goToLastPage,
    startIndex,
    endIndex,
  } = paginationResult;

  // Data to display (paginated if enabled, otherwise all sorted data)
  const displayData = enablePagination ? paginatedData : sortedData;

  const getSortIcon = useCallback((columnKey: string) => {
    if (sortConfig.key !== columnKey) {
      return null;
    }
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  }, [sortConfig]);

  // Calculate sticky column positions based on visible columns
  const getStickyPosition = useCallback((columnKey: string): string => {
    if (!stickyColumns.length) return '';
    
    const visibleStickyColumns = stickyColumns.filter(key => isColumnVisible(key));
    const index = visibleStickyColumns.indexOf(columnKey);
    
    if (index === -1) return '';
    
    // Calculate left position based on index
    // These positions match the original implementations
    if (index === 0) return 'sm:left-0';
    if (index === 1) return 'sm:left-[60px]';
    if (index === 2) return 'sm:left-[260px]';
    if (index === 3) return 'sm:left-[360px]';
    return '';
  }, [stickyColumns, isColumnVisible]);

  // Optimistic filter update
  const handleFilterChange = useCallback((newFilters: FilterValues) => {
    setFilterValues(newFilters);
  }, []);

  // Generate row key - must be defined before it's used in handlers
  const getItemRowKey = useCallback((item: T, index: number) => {
    if (getRowKey) {
      return getRowKey(item, index);
    }
    // Default: try to use ticker and companyName
    const ticker = 'ticker' in item && typeof item.ticker === 'string' ? item.ticker : '';
    const companyName = 'companyName' in item && typeof item.companyName === 'string' ? item.companyName : '';
    return `${ticker}-${companyName}-${index}`;
  }, [getRowKey]);

  // Toggle row expansion for mobile view
  const toggleRow = useCallback((rowKey: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [rowKey]: !prev[rowKey],
    }));
  }, []);

  // Keyboard navigation handlers
  const handleTableKeyDown = useCallback((e: React.KeyboardEvent<HTMLTableElement>) => {
    if (!displayData.length) return;

    const maxIndex = displayData.length - 1;
    let newIndex = focusedRowIndex ?? -1;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        newIndex = newIndex < maxIndex ? newIndex + 1 : newIndex;
        setFocusedRowIndex(newIndex);
        // Scroll into view
        setTimeout(() => {
          const row = tableRef.current?.querySelector(`tr[data-row-index="${newIndex}"]`);
          row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }, 0);
        break;
      case 'ArrowUp':
        e.preventDefault();
        newIndex = newIndex > 0 ? newIndex - 1 : 0;
        setFocusedRowIndex(newIndex);
        // Scroll into view
        setTimeout(() => {
          const row = tableRef.current?.querySelector(`tr[data-row-index="${newIndex}"]`);
          row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }, 0);
        break;
      case 'Enter':
        if (focusedRowIndex !== null && focusedRowIndex >= 0 && focusedRowIndex < displayData.length) {
          e.preventDefault();
          const item = displayData[focusedRowIndex];
          const globalIndex = enablePagination ? startIndex - 1 + focusedRowIndex : focusedRowIndex;
          const rowKey = getItemRowKey(item, globalIndex);
          toggleRow(rowKey);
        }
        break;
      case 'Home':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          setFocusedRowIndex(0);
        }
        break;
      case 'End':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          setFocusedRowIndex(maxIndex);
        }
        break;
    }
  }, [displayData, focusedRowIndex, enablePagination, startIndex, getItemRowKey, toggleRow]);

  // Handle row click to set focus
  const handleRowClick = useCallback((index: number) => {
    setFocusedRowIndex(index);
  }, []);

  // Export handler
  const handleExport = useCallback((format: 'csv' | 'excel' = 'csv') => {
    if (!enableExport || sortedData.length === 0) return;

    // Convert columns to export format
    const exportColumns: ExportColumn<T>[] = columns
      .filter((col) => isColumnVisible(col.key))
      .map((col) => ({
        key: col.key,
        label: col.label,
        accessor: (item: T) => {
          // Try to get value from renderCell if available, otherwise use direct access
          const value = item[col.key];
          if (value === null || value === undefined) {
            return '';
          }
          if (typeof value === 'object') {
            return JSON.stringify(value);
          }
          return String(value);
        },
      }));

    const filename = exportFilename || `${tableId}_export_${new Date().toISOString().split('T')[0]}`;
    const exportDate = new Date();
    
    // Build filter info string
    const activeFilters = Object.entries(filterValues)
      .filter(([_, value]) => value !== null && value !== '' && value !== undefined)
      .map(([key, value]) => {
        const filter = filters.find((f) => f.key === key);
        const label = filter?.label || key;
        if (typeof value === 'object' && value !== null && ('min' in value || 'max' in value)) {
          const range = value as { min?: number; max?: number };
          const parts: string[] = [];
          if (range.min !== undefined) parts.push(`≥${range.min}`);
          if (range.max !== undefined) parts.push(`≤${range.max}`);
          return `${label}: ${parts.join(' - ')}`;
        }
        return `${label}: ${value}`;
      })
      .join(', ');

    try {
      exportTableData(data, sortedData, exportColumns, format, {
        filename,
        includeHeaders: true,
        includeMetadata: true,
        metadata: {
          tableName: tableId,
          exportDate,
          filterInfo: activeFilters || 'No filters',
          rowCount: sortedData.length,
        },
      });
      
      createNotification(
        'success',
        'Export Complete',
        `Exported ${sortedData.length} rows to ${format.toUpperCase()}`,
        {
          showDesktop: false,
          persistent: false,
        }
      );
    } catch (error) {
      createNotification(
        'error',
        'Export Failed',
        `Failed to export data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          showDesktop: true,
          persistent: false,
        }
      );
    }
  }, [enableExport, sortedData, columns, isColumnVisible, data, tableId, exportFilename, createNotification]);

  // Print handler
  const handlePrint = useCallback(() => {
    if (!enablePrint) return;
    const tableElement = tableRef.current;
    const tableName = printTableName || tableId;
    
    // Build filter info string
    const activeFilters = Object.entries(filterValues)
      .filter(([_, value]) => value !== null && value !== '' && value !== undefined)
      .map(([key, value]) => {
        const filter = filters.find((f) => f.key === key);
        const label = filter?.label || key;
        if (typeof value === 'object' && value !== null && ('min' in value || 'max' in value)) {
          const range = value as { min?: number; max?: number };
          const parts: string[] = [];
          if (range.min !== undefined) parts.push(`≥${range.min}`);
          if (range.max !== undefined) parts.push(`≤${range.max}`);
          return `${label}: ${parts.join(' - ')}`;
        }
        return `${label}: ${value}`;
      })
      .join(', ');
    
    printTable(tableElement, tableName, {
      includeHeader: true,
      includeFooter: true,
      filterInfo: activeFilters || 'No filters',
      rowCount: sortedData.length,
    });
  }, [enablePrint, printTableName, tableId, filterValues, filters, sortedData.length]);

  // Default header renderer
  const defaultRenderHeader = useCallback((props: HeaderRenderProps<T>) => {
    const { column, sortConfig, handleSort, getSortIcon, getStickyPosition } = props;
    const isSticky = stickyColumns.includes(column.key);
    const isSorted = sortConfig.key === column.key;
    const sortIcon = getSortIcon(column.key);
    const stickyClass = isSticky ? `sm:sticky sm:top-0 ${getStickyPosition(column.key)} z-50` : '';
    
    const columnWidth = enableColumnResize ? getColumnWidth(column.key) : undefined;
    const isResizing = enableColumnResize && resizingColumn === column.key;
    const isFilterMenuOpen = openFilterMenuColumn === column.key;
    const hasActiveFilter = hasActiveColumnFilter(column.key);
    const headerRef = headerRefs.current[column.key] || null;
    
    const handleFilterIconClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      // Close any other open menu, then toggle this one
      if (isFilterMenuOpen) {
        setOpenFilterMenuColumn(null);
      } else {
        setOpenFilterMenuColumn(column.key);
      }
    };

    const handleSortClick = (e: React.MouseEvent) => {
      // Only sort if clicking on the label area, not on filter icon
      if (!isFilterMenuOpen) {
        e.stopPropagation();
        handleSort(column.key);
      }
    };

    const filterIcon = (
      <button
        onClick={handleFilterIconClick}
        className={`ml-2 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${
          hasActiveFilter ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
        }`}
        aria-label={`Filter ${column.label}`}
        aria-expanded={isFilterMenuOpen}
        title="Filter och sortering"
        type="button"
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
      </button>
    );

    const headerContent = (
      <div className="flex items-center justify-between relative w-full">
        <div className="flex items-center flex-1" onClick={column.sortable ? handleSortClick : undefined}>
          {column.sortable && (
            <div className={`flex items-center ${column.sortable ? 'cursor-pointer' : ''}`}>
              <span>{column.label}</span>
              {sortIcon && <span className="ml-1 text-gray-600 dark:text-gray-300">{sortIcon}</span>}
            </div>
          )}
          {!column.sortable && <span>{column.label}</span>}
        </div>
        <div className="flex items-center relative" style={{ minWidth: '40px' }}>
          <div className="relative">
            {filterIcon}
            {isFilterMenuOpen && headerRef && (
              <ColumnFilterMenu
                columnKey={column.key}
                columnLabel={column.label}
                isOpen={isFilterMenuOpen}
                onClose={() => setOpenFilterMenuColumn(null)}
                filter={columnFilters[column.key]}
                onFilterChange={(filter) => setColumnFilter(column.key, filter)}
                sortConfig={sortConfig}
                onSort={handleColumnSort}
                uniqueValues={getColumnUniqueValues(column.key)}
                triggerRef={{ current: headerRef }}
              />
            )}
          </div>
          {enableColumnResize && (
            <div
              className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 dark:hover:bg-blue-400 transition-colors duration-base"
              onMouseDown={(e) => {
                if (column.sortable) {
                  e.stopPropagation();
                }
                handleResizeStart(column.key, e);
              }}
              role="separator"
              aria-orientation="vertical"
              aria-label={t('aria.resizeColumn', 'Ändra kolumnbredd')}
            />
          )}
        </div>
      </div>
    );
    
    if (!column.sortable) {
      return (
        <th
          ref={(el) => {
            headerRefs.current[column.key] = el;
          }}
          className={`px-6 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider ${stickyClass} bg-gray-50 dark:bg-gray-900 ${isResizing ? 'bg-blue-100 dark:bg-blue-900/50' : ''}`}
          style={columnWidth ? { width: `${columnWidth}px`, minWidth: `${columnWidth}px`, maxWidth: `${columnWidth}px` } : undefined}
          scope="col"
          role="columnheader"
        >
          {headerContent}
        </th>
      );
    }
    
    return (
      <th
        ref={(el) => {
          headerRefs.current[column.key] = el;
        }}
        className={`px-6 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-200 transition-all duration-base ${stickyClass} bg-gray-50 dark:bg-gray-900 ${isResizing ? 'bg-blue-100 dark:bg-blue-900/50' : ''}`}
        style={columnWidth ? { width: `${columnWidth}px`, minWidth: `${columnWidth}px`, maxWidth: `${columnWidth}px` } : undefined}
        scope="col"
        role="columnheader"
        aria-label={`${t('aria.sortColumn')}: ${column.label}`}
        aria-sort={isSorted ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        {headerContent}
      </th>
    );
  }, [stickyColumns, enableColumnResize, getColumnWidth, resizingColumn, handleResizeStart, t, openFilterMenuColumn, hasActiveColumnFilter, columnFilters, getColumnUniqueValues, handleSort, sortConfig]);

  // Default mobile card renderer
  const defaultRenderMobileCard = useCallback((item: T, index: number, globalIndex: number, isExpanded: boolean, toggleExpand: () => void) => {
    const rowBgClass = globalIndex % 2 === 0 
      ? 'bg-white dark:bg-gray-800' 
      : 'bg-gray-50 dark:bg-gray-800';
    const rowKey = getItemRowKey(item, globalIndex);

    return (
      <div
        className={`${rowBgClass} rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm transition-all duration-300 ease-in-out`}
      >
        <div className="p-4 flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            {columns
              .filter(col => isColumnVisible(col.key))
              .slice(0, enableMobileExpand ? 3 : undefined)
              .map((column) => (
                <div key={column.key} className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    {column.label}
                  </span>
                  <span className="text-sm text-black dark:text-white text-right">
                    {column.renderCell
                      ? column.renderCell(item, column, index, globalIndex, expandedRows, toggleRow)
                      : renderCell(item, column, index, globalIndex, expandedRows, toggleRow)}
                  </span>
                </div>
              ))}
          </div>
          {enableMobileExpand && (
            <button
              onClick={toggleExpand}
              className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-all duration-200 flex-shrink-0"
              aria-label={isExpanded ? t('aria.collapseRow') : t('aria.expandRow')}
              aria-expanded={isExpanded}
            >
              <svg
                className={`w-5 h-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
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
          )}
        </div>
        {enableMobileExpand && isExpanded && (
          <div className="border-t border-gray-300 dark:border-gray-600 p-4 space-y-3 animate-fade-in">
            {columns
              .filter(col => isColumnVisible(col.key))
              .slice(3)
              .map((column) => (
                <div key={column.key} className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    {column.label}
                  </span>
                  <span className="text-sm text-black dark:text-white text-right">
                    {column.renderCell
                      ? column.renderCell(item, column, index, globalIndex, expandedRows, toggleRow)
                      : renderCell(item, column, index, globalIndex, expandedRows, toggleRow)}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
    );
  }, [columns, isColumnVisible, enableMobileExpand, renderCell, expandedRows, toggleRow, getItemRowKey]);

  if (loading) {
    return (
      <div role="status" aria-live="polite" aria-label={t('aria.loading')}>
        <TableSkeleton rows={15} columns={columns.length} hasStickyColumns={stickyColumns.length > 0} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8" role="alert" aria-live="assertive">
        <h3 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">{t('aria.error')}</h3>
        <p className="text-base font-medium text-gray-700 dark:text-gray-300">{error}</p>
      </div>
    );
  }

  const headerRenderProps: HeaderRenderProps<T> = {
    column: columns[0], // Will be overridden per column
    sortConfig,
    handleSort: (key: string) => handleSort(key as keyof T),
    getSortIcon,
    getStickyPosition,
    isColumnVisible,
    openFilterMenuColumn,
    setOpenFilterMenuColumn,
    hasActiveColumnFilter,
    getColumnUniqueValues,
    columnFilters,
    setColumnFilter,
    handleColumnSort,
    headerRefs,
  };

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden h-full flex flex-col transition-all duration-normal ease-in-out">
        <div className="bg-white dark:bg-gray-800 border-b border-gray-300 dark:border-gray-500 px-4 py-3 flex items-center justify-between gap-4 flex-shrink-0">
          <div className="flex-1">
            <TableSearchBar
              searchValue={searchValue}
              onSearchChange={setSearchValue}
              totalRows={data.length}
              filteredRows={filteredData.length}
              placeholder={searchPlaceholder}
            />
          </div>
          <div className="flex items-center gap-2">
            <ColumnVisibilityToggle
              columns={columns}
              columnVisibility={columnVisibility}
              onToggleColumn={toggleColumn}
              onShowAll={showAllColumns}
              onHideAll={hideAllColumns}
              onReset={resetToDefaults}
              isColumnVisible={isColumnVisible}
            />
            {enableExport && sortedData.length > 0 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport('csv')}
                  leftIcon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  }
                  aria-label={t('export.csv', 'Exportera till CSV')}
                  title={t('export.csv', 'Exportera till CSV')}
                >
                  CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport('excel')}
                  leftIcon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  }
                  aria-label={t('export.excel', 'Exportera till Excel')}
                  title={t('export.excel', 'Exportera till Excel')}
                >
                  Excel
                </Button>
              </div>
            )}
            {enablePrint && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                leftIcon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                }
                aria-label={t('print.print', 'Skriv ut')}
                title={t('print.print', 'Skriv ut')}
              >
                {t('print.print', 'Skriv ut')}
              </Button>
            )}
            {enableShareableLink && currentUser && viewId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShareableLinkModalOpen(true)}
                leftIcon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                }
                aria-label={t('shareableLinks.share', 'Share Link')}
                title={t('shareableLinks.share', 'Share Link')}
              >
                {t('shareableLinks.share', 'Share')}
              </Button>
            )}
            {headerActions}
          </div>
        </div>
        
        {/* Table View */}
        <div className="flex-1 overflow-auto min-h-0 sm:overflow-y-auto">
          <table 
            ref={tableRef}
            className="min-w-full sm:min-w-full divide-y divide-gray-300 dark:divide-gray-600"
            style={{ minWidth: minTableWidth }}
            role="grid"
            aria-label={ariaLabel || tableId}
            onKeyDown={handleTableKeyDown}
            tabIndex={0}
          >
            <thead className="sticky top-0 z-40 bg-gray-50 dark:bg-gray-900">
              {enableColumnReorder ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={orderedColumns.filter((col) => isColumnVisible(col.key)).map((col) => col.key)}
                    strategy={horizontalListSortingStrategy}
                  >
                    <tr role="row" aria-rowindex={1}>
                      {orderedColumns
                        .filter((col) => isColumnVisible(col.key))
                        .map((column) => {
                          headerRenderProps.column = column;
                          const isResizing = enableColumnResize && resizingColumn === column.key;
                          const columnWidth = enableColumnResize ? getColumnWidth(column.key) : undefined;
                          
                          const headerContent = column.renderHeader 
                            ? column.renderHeader(headerRenderProps)
                            : (renderHeader ? renderHeader(headerRenderProps) : defaultRenderHeader(headerRenderProps));
                          
                          // Extract content from header if it's a React element
                          let headerChildren: React.ReactNode = headerContent;
                          let headerClassName = '';
                          if (React.isValidElement(headerContent)) {
                            const props = headerContent.props as { children?: React.ReactNode; className?: string };
                            headerChildren = props.children || headerContent;
                            headerClassName = props.className || '';
                          }
                          
                          return (
                            <SortableTableHeader
                              key={column.key}
                              id={column.key}
                              className={headerClassName}
                              style={columnWidth ? { width: `${columnWidth}px`, minWidth: `${columnWidth}px`, maxWidth: `${columnWidth}px` } : undefined}
                              isResizing={isResizing}
                              enableResize={enableColumnResize}
                              onResizeStart={enableColumnResize ? (e) => handleResizeStart(column.key, e) : undefined}
                            >
                              {headerChildren}
                            </SortableTableHeader>
                          );
                        })}
                    </tr>
                  </SortableContext>
                </DndContext>
              ) : (
                <tr role="row" aria-rowindex={1}>
                  {orderedColumns
                    .filter((col) => isColumnVisible(col.key))
                    .map((column, colIndex) => {
                      headerRenderProps.column = column;
                      const headerContent = column.renderHeader 
                        ? column.renderHeader(headerRenderProps)
                        : (renderHeader ? renderHeader(headerRenderProps) : defaultRenderHeader(headerRenderProps));
                      // Add aria-colindex to header cells
                      const headerWithIndex = React.isValidElement(headerContent) 
                        ? React.cloneElement(headerContent as React.ReactElement<{ 'aria-colindex'?: number }>, { 'aria-colindex': colIndex + 1 })
                        : headerContent;
                      return <React.Fragment key={column.key}>{headerWithIndex}</React.Fragment>;
                    })}
                </tr>
              )}
            </thead>
            {enableVirtualScroll ? (
              <VirtualTableBody
                data={displayData}
                renderRow={(item, index, globalIndex) => {
                  const rowKey = getItemRowKey(item, globalIndex);
                  const rowBgClass = globalIndex % 2 === 0 
                    ? 'bg-white dark:bg-gray-800' 
                    : 'bg-gray-50 dark:bg-gray-800';
                  
                  const isFocused = focusedRowIndex === index;
                  const isExpanded = expandedRows[rowKey] || false;
                  const visibleColumnsCount = orderedColumns.filter(col => isColumnVisible(col.key)).length;
                  
                  return (
                    <React.Fragment key={rowKey}>
                      <tr 
                        data-row-index={index}
                        className={`group transition-all duration-normal ease-in-out hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:shadow-md cursor-pointer transition-colors duration-base ${rowBgClass} ${isFocused ? 'ring-2 ring-blue-500 dark:ring-blue-400 bg-blue-50 dark:bg-blue-900/30' : ''}`}
                        onClick={() => handleRowClick(index)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleRow(rowKey);
                          }
                        }}
                        tabIndex={0}
                        role="row"
                        aria-rowindex={globalIndex + 2}
                        aria-label={`Row ${globalIndex + 1}: ${'companyName' in item && typeof item.companyName === 'string' ? item.companyName : 'Item ' + (globalIndex + 1)}`}
                        aria-expanded={isExpanded}
                      >
                        {orderedColumns
                          .filter(col => isColumnVisible(col.key))
                          .map((column, colIndex) => {
                            const cellContent = column.renderCell
                              ? column.renderCell(item, column, index, globalIndex, expandedRows, toggleRow)
                              : renderCell(item, column, index, globalIndex, expandedRows, toggleRow);
                            
                            const isSticky = stickyColumns.includes(column.key);
                            const stickyClass = isSticky ? `sm:sticky ${getStickyPosition(column.key)} z-20` : '';
                            const alignClass = column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : '';
                            const bgClass = globalIndex % 2 === 0 
                              ? 'bg-white dark:bg-gray-800 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20' 
                              : 'bg-gray-50 dark:bg-gray-800 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20';
                            const columnWidth = enableColumnResize ? getColumnWidth(column.key) : undefined;
                            
                            return (
                              <td
                                key={column.key}
                                className={`px-6 py-4 whitespace-nowrap text-sm text-black dark:text-white transition-colors duration-base ${stickyClass} ${alignClass} ${isSticky ? bgClass : ''}`}
                                style={columnWidth ? { width: `${columnWidth}px`, minWidth: `${columnWidth}px`, maxWidth: `${columnWidth}px` } : undefined}
                                role="gridcell"
                                aria-colindex={colIndex + 1}
                              >
                                {cellContent}
                              </td>
                            );
                          })}
                      </tr>
                      {isExpanded && renderExpandedRow && (
                        <tr 
                          className="bg-gray-50 dark:bg-gray-900/50 transition-all duration-300 ease-in-out"
                          role="row"
                          aria-rowindex={globalIndex + 3}
                        >
                          <td 
                            colSpan={visibleColumnsCount} 
                            className="px-0 py-0"
                            role="gridcell"
                          >
                            {renderExpandedRow(item, index, globalIndex)}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                }}
                rowHeight={virtualScrollRowHeight}
                overscan={virtualScrollOverscan}
                className="divide-y divide-gray-300 dark:divide-gray-600"
              />
            ) : (
              <tbody className="divide-y divide-gray-300 dark:divide-gray-600">
                {displayData.length === 0 ? (
                  <tr role="row">
                    <td 
                      colSpan={orderedColumns.filter(col => isColumnVisible(col.key)).length} 
                      className="px-6 py-8 text-center text-gray-600 dark:text-gray-300"
                      role="gridcell"
                    >
                      <div className="text-sm">{searchValue || hasColumnFilters ? 'Inga resultat hittades.' : (emptyMessage || t('aria.noData'))}</div>
                      {(searchValue || hasColumnFilters) && (
                        <div className="text-xs mt-2 text-gray-500 dark:text-gray-400">
                          Försök ändra dina sökkriterier eller filter.
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  displayData.map((item, index) => {
                    const globalIndex = enablePagination ? startIndex - 1 + index : index;
                    const rowKey = getItemRowKey(item, globalIndex);
                    const rowBgClass = globalIndex % 2 === 0 
                      ? 'bg-white dark:bg-gray-800' 
                      : 'bg-gray-50 dark:bg-gray-800';
                    
                    const isFocused = focusedRowIndex === index;
                    const isExpanded = expandedRows[rowKey] || false;
                    const visibleColumnsCount = orderedColumns.filter(col => isColumnVisible(col.key)).length;
                    
                    return (
                      <React.Fragment key={rowKey}>
                        <tr 
                          data-row-index={index}
                          className={`group transition-all duration-normal ease-in-out hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:shadow-md cursor-pointer transition-colors duration-base animate-fade-in ${rowBgClass} ${isFocused ? 'ring-2 ring-blue-500 dark:ring-blue-400 bg-blue-50 dark:bg-blue-900/30' : ''}`}
                          style={{ animationDelay: `${index * 10}ms` }}
                          onClick={() => handleRowClick(index)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              const globalIndex = enablePagination ? startIndex - 1 + index : index;
                              const rowKey = getItemRowKey(item, globalIndex);
                              toggleRow(rowKey);
                            }
                          }}
                          tabIndex={0}
                          role="row"
                          aria-rowindex={globalIndex + 2}
                          aria-label={`Row ${globalIndex + 1}: ${'companyName' in item && typeof item.companyName === 'string' ? item.companyName : 'Item ' + (globalIndex + 1)}`}
                          aria-expanded={isExpanded}
                        >
                          {orderedColumns
                            .filter(col => isColumnVisible(col.key))
                            .map((column, colIndex) => {
                              const cellContent = column.renderCell
                                ? column.renderCell(item, column, index, globalIndex, expandedRows, toggleRow)
                                : renderCell(item, column, index, globalIndex, expandedRows, toggleRow);
                              
                              const isSticky = stickyColumns.includes(column.key);
                              const stickyClass = isSticky ? `sm:sticky ${getStickyPosition(column.key)} z-20` : '';
                              const alignClass = column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : '';
                              const bgClass = globalIndex % 2 === 0 
                                ? 'bg-white dark:bg-gray-800 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20' 
                                : 'bg-gray-50 dark:bg-gray-800 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20';
                              const columnWidth = enableColumnResize ? getColumnWidth(column.key) : undefined;
                              
                              return (
                                <td
                                  key={column.key}
                                  className={`px-6 py-4 whitespace-nowrap text-sm text-black dark:text-white transition-colors duration-base ${stickyClass} ${alignClass} ${isSticky ? bgClass : ''}`}
                                  style={columnWidth ? { width: `${columnWidth}px`, minWidth: `${columnWidth}px`, maxWidth: `${columnWidth}px` } : undefined}
                                  role="gridcell"
                                  aria-colindex={colIndex + 1}
                                >
                                  {cellContent}
                                </td>
                              );
                            })}
                        </tr>
                        {isExpanded && renderExpandedRow && (
                          <tr 
                            className="bg-gray-50 dark:bg-gray-900/50 transition-all duration-300 ease-in-out"
                            role="row"
                            aria-rowindex={globalIndex + 3}
                          >
                            <td 
                              colSpan={visibleColumnsCount} 
                              className="px-0 py-0"
                              role="gridcell"
                            >
                              {renderExpandedRow(item, index, globalIndex)}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            )}
          </table>
        </div>
        
        {/* Pagination */}
        {enablePagination && totalPages > 1 && (
          <div className="rounded-b-lg overflow-visible">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={actualItemsPerPage}
              startIndex={startIndex}
              endIndex={endIndex}
              onPageChange={goToPage}
              onNextPage={nextPage}
              onPreviousPage={previousPage}
              onFirstPage={goToFirstPage}
              onLastPage={goToLastPage}
            />
          </div>
        )}
        
        {/* Row count footer (for non-paginated tables) */}
        {!enablePagination && displayData.length > 0 && (
          <div className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 border-t border-gray-300 dark:border-gray-500">
            Visar {displayData.length} {displayData.length === 1 ? 'rad' : 'rader'} av {displayData.length} totalt
          </div>
        )}
      </div>
      {enableShareableLink && currentUser && viewId && (
        <ShareableLinkModal
          isOpen={shareableLinkModalOpen}
          onClose={() => setShareableLinkModalOpen(false)}
          filterState={filterValues}
          viewId={viewId}
          tableId={tableId}
          sortConfig={sortConfig.key ? { key: String(sortConfig.key), direction: sortConfig.direction } : undefined}
        />
      )}
    </>
  );
}

