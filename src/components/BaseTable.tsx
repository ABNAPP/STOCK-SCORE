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
import AdvancedFilters from './AdvancedFilters';
import { FilterConfig, FilterValues } from '../types/filters';
import QuickFilters from './QuickFilters';
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

// Lazy load help components
const HelpButton = lazy(() => import('./HelpButton'));
const OnboardingHelp = lazy(() => import('./OnboardingHelp'));

export interface ColumnDefinition<T = unknown> extends ColumnConfig {
  sortable?: boolean;
  sticky?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
  renderHeader?: (props: HeaderRenderProps<T>) => ReactNode;
  renderCell?: (item: T, column: ColumnDefinition<T>, index: number, globalIndex: number) => ReactNode;
}

export interface HeaderRenderProps<T = unknown> {
  column: ColumnDefinition<T>;
  sortConfig: SortConfig<T>;
  handleSort: (key: string) => void;
  getSortIcon: (columnKey: string) => string | null;
  getStickyPosition: (columnKey: string) => string;
  isColumnVisible: (columnKey: string) => boolean;
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
  renderCell: (item: T, column: ColumnDefinition<T>, index: number, globalIndex: number) => ReactNode;
  renderHeader?: (props: HeaderRenderProps<T>) => ReactNode;
  renderMobileCard?: (item: T, index: number, globalIndex: number, isExpanded: boolean, toggleExpand: () => void) => ReactNode;
  
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
  const [showHelp, setShowHelp] = useState(false);
  const [expandedRows, setExpandedRows] = useState<{ [key: string]: boolean }>({});
  const [focusedRowIndex, setFocusedRowIndex] = useState<number | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  
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

  // Search/filter data
  const { searchValue, setSearchValue, filteredData } = useTableSearch<T>({
    data,
    searchFields,
    advancedFilters: filterValues,
  });

  // Sort filtered data
  const { sortedData, sortConfig, handleSort } = useTableSort(
    filteredData,
    defaultSortKey || (searchFields[0] as keyof T),
    defaultSortDirection
  );

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

  const handleClearFilters = useCallback(() => {
    setFilterValues({});
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
    
    if (!column.sortable) {
      return (
        <th
          className={`px-6 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider ${stickyClass} bg-gray-50 dark:bg-gray-900 ${isResizing ? 'bg-blue-100 dark:bg-blue-900/50' : ''}`}
          style={columnWidth ? { width: `${columnWidth}px`, minWidth: `${columnWidth}px`, maxWidth: `${columnWidth}px` } : undefined}
          scope="col"
          role="columnheader"
        >
          <div className="flex items-center justify-between relative">
            <span>{column.label}</span>
            {enableColumnResize && (
              <div
                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 dark:hover:bg-blue-400 transition-colors duration-base"
                onMouseDown={(e) => handleResizeStart(column.key, e)}
                role="separator"
                aria-orientation="vertical"
                aria-label={t('aria.resizeColumn', 'Ändra kolumnbredd')}
              />
            )}
          </div>
        </th>
      );
    }
    
    return (
      <th
        onClick={() => handleSort(column.key)}
        className={`px-6 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-200 transition-all duration-base ${stickyClass} bg-gray-50 dark:bg-gray-900 ${isResizing ? 'bg-blue-100 dark:bg-blue-900/50' : ''}`}
        style={columnWidth ? { width: `${columnWidth}px`, minWidth: `${columnWidth}px`, maxWidth: `${columnWidth}px` } : undefined}
        scope="col"
        role="columnheader"
        aria-label={`${t('aria.sortColumn')}: ${column.label}`}
        aria-sort={isSorted ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <div className="flex items-center space-x-1 relative">
          <div className="flex items-center">
            <span>{column.label}</span>
            {sortIcon && <span className="text-gray-600 dark:text-gray-300">{sortIcon}</span>}
          </div>
          {enableColumnResize && (
            <div
              className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 dark:hover:bg-blue-400 transition-colors duration-base"
              onMouseDown={(e) => {
                e.stopPropagation();
                handleResizeStart(column.key, e);
              }}
              role="separator"
              aria-orientation="vertical"
              aria-label={t('aria.resizeColumn', 'Ändra kolumnbredd')}
            />
          )}
        </div>
      </th>
    );
  }, [stickyColumns, enableColumnResize, getColumnWidth, resizingColumn, handleResizeStart, t]);

  // Default mobile card renderer
  const defaultRenderMobileCard = useCallback((item: T, index: number, globalIndex: number, isExpanded: boolean, toggleExpand: () => void) => {
    const rowBgClass = globalIndex % 2 === 0 
      ? 'bg-white dark:bg-gray-800' 
      : 'bg-gray-50 dark:bg-gray-800';

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
                  <span className="text-sm text-gray-900 dark:text-gray-100 text-right">
                    {renderCell(item, column, index, globalIndex)}
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
                  <span className="text-sm text-gray-900 dark:text-gray-100 text-right">
                    {renderCell(item, column, index, globalIndex)}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
    );
  }, [columns, isColumnVisible, enableMobileExpand, renderCell]);

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

  if (sortedData.length === 0 && !loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8" role="status" aria-live="polite">
        <p className="text-gray-600 dark:text-gray-300 text-center">
          {searchValue ? 'Inga resultat hittades.' : (emptyMessage || t('aria.noData'))}
        </p>
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
  };

  return (
    <>
      {showHelp && enableHelp && (
        <Suspense fallback={null}>
          <OnboardingHelp tableId={tableId} />
        </Suspense>
      )}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden h-full flex flex-col transition-all duration-normal ease-in-out">
        <QuickFilters
          filters={filters}
          values={filterValues}
          onChange={handleFilterChange}
          tableId={tableId}
        />
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
            {enableHelp && (
              <Suspense fallback={null}>
                <HelpButton onOpenHelp={() => setShowHelp(true)} />
              </Suspense>
            )}
            <AdvancedFilters
              filters={filters}
              values={filterValues}
              onChange={handleFilterChange}
              onClear={handleClearFilters}
              tableId={tableId}
            />
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
        
        {/* Desktop Table View (≥1024px) */}
        <div className="hidden lg:block flex-1 overflow-auto min-h-0 sm:overflow-y-auto">
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
                  return (
                    <tr 
                      key={rowKey}
                      data-row-index={index}
                      className={`group transition-all duration-normal ease-in-out hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:shadow-md cursor-pointer transition-colors duration-base ${rowBgClass} ${isFocused ? 'ring-2 ring-blue-500 dark:ring-blue-400 bg-blue-50 dark:bg-blue-900/30' : ''}`}
                      onClick={() => handleRowClick(index)}
                      tabIndex={0}
                      role="row"
                      aria-rowindex={globalIndex + 2}
                      aria-label={`Row ${globalIndex + 1}: ${'companyName' in item && typeof item.companyName === 'string' ? item.companyName : 'Item ' + (globalIndex + 1)}`}
                    >
                      {orderedColumns
                        .filter(col => isColumnVisible(col.key))
                        .map((column, colIndex) => {
                          const cellContent = column.renderCell
                            ? column.renderCell(item, column, index, globalIndex)
                            : renderCell(item, column, index, globalIndex);
                          
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
                              className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 transition-colors duration-base ${stickyClass} ${alignClass} ${isSticky ? bgClass : ''}`}
                              style={columnWidth ? { width: `${columnWidth}px`, minWidth: `${columnWidth}px`, maxWidth: `${columnWidth}px` } : undefined}
                              role="gridcell"
                              aria-colindex={colIndex + 1}
                            >
                              {cellContent}
                            </td>
                          );
                        })}
                    </tr>
                  );
                }}
                rowHeight={virtualScrollRowHeight}
                overscan={virtualScrollOverscan}
                className="divide-y divide-gray-300 dark:divide-gray-600"
              />
            ) : (
              <tbody className="divide-y divide-gray-300 dark:divide-gray-600">
                {displayData.map((item, index) => {
                  const globalIndex = enablePagination ? startIndex - 1 + index : index;
                  const rowKey = getItemRowKey(item, globalIndex);
                  const rowBgClass = globalIndex % 2 === 0 
                    ? 'bg-white dark:bg-gray-800' 
                    : 'bg-gray-50 dark:bg-gray-800';
                  
                  const isFocused = focusedRowIndex === index;
                  return (
                    <tr 
                      key={rowKey}
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
                    >
                      {orderedColumns
                        .filter(col => isColumnVisible(col.key))
                        .map((column, colIndex) => {
                          const cellContent = column.renderCell
                            ? column.renderCell(item, column, index, globalIndex)
                            : renderCell(item, column, index, globalIndex);
                          
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
                              className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 transition-colors duration-base ${stickyClass} ${alignClass} ${isSticky ? bgClass : ''}`}
                              style={columnWidth ? { width: `${columnWidth}px`, minWidth: `${columnWidth}px`, maxWidth: `${columnWidth}px` } : undefined}
                              role="gridcell"
                              aria-colindex={colIndex + 1}
                            >
                              {cellContent}
                            </td>
                          );
                        })}
                    </tr>
                  );
                })}
              </tbody>
            )}
          </table>
        </div>
        
        {/* Mobile Card View (<1024px) */}
        <div className="lg:hidden flex-1 overflow-auto min-h-0 space-y-4 p-4">
          {displayData.map((item, index) => {
            const globalIndex = enablePagination ? startIndex - 1 + index : index;
            const rowKey = getItemRowKey(item, globalIndex);
            const isExpanded = expandedRows[rowKey] || false;
            
            if (renderMobileCard) {
              return (
                <React.Fragment key={rowKey}>
                  {renderMobileCard(item, index, globalIndex, isExpanded, () => toggleRow(rowKey))}
                </React.Fragment>
              );
            }
            
            return (
              <React.Fragment key={rowKey}>
                {defaultRenderMobileCard(item, index, globalIndex, isExpanded, () => toggleRow(rowKey))}
              </React.Fragment>
            );
          })}
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

