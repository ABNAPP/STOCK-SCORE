import React, { useState, useCallback, useMemo, ReactNode } from 'react';
import { useTableSort, SortConfig } from '../hooks/useTableSort';
import { useTableSearch } from '../hooks/useTableSearch';
import { useTablePagination } from '../hooks/useTablePagination';
import { useColumnVisibility, ColumnConfig } from '../hooks/useColumnVisibility';
import VirtualTableBody from './VirtualTableBody';
import { TableSkeleton } from './SkeletonLoader';
import TableSearchBar from './TableSearchBar';
import Pagination from './Pagination';
import ColumnVisibilityToggle from './ColumnVisibilityToggle';
import AdvancedFilters, { FilterConfig, FilterValues } from './AdvancedFilters';
import HelpButton from './HelpButton';
import OnboardingHelp from './OnboardingHelp';
import EmptyState from './EmptyState';
import { useTranslation } from 'react-i18next';

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
}: BaseTableProps<T>) {
  const { t } = useTranslation();
  const [filterValues, setFilterValues] = useState<FilterValues>({});
  const [showHelp, setShowHelp] = useState(false);
  const [expandedRows, setExpandedRows] = useState<{ [key: string]: boolean }>({});
  
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

  // Toggle row expansion for mobile view
  const toggleRow = useCallback((rowKey: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [rowKey]: !prev[rowKey],
    }));
  }, []);

  // Default header renderer
  const defaultRenderHeader = useCallback((props: HeaderRenderProps<T>) => {
    const { column, sortConfig, handleSort, getSortIcon, getStickyPosition } = props;
    const isSticky = stickyColumns.includes(column.key);
    const isSorted = sortConfig.key === column.key;
    const sortIcon = getSortIcon(column.key);
    const stickyClass = isSticky ? `sm:sticky sm:top-0 ${getStickyPosition(column.key)} z-50` : '';
    
    if (!column.sortable) {
      return (
        <th
          className={`px-6 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider ${stickyClass} bg-gray-50 dark:bg-gray-900`}
          scope="col"
          role="columnheader"
        >
          {column.label}
        </th>
      );
    }

    return (
      <th
        onClick={() => handleSort(column.key)}
        className={`px-6 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-200 transition-all duration-200 ${stickyClass} bg-gray-50 dark:bg-gray-900`}
        scope="col"
        role="columnheader"
        aria-label={`${t('aria.sortColumn')}: ${column.label}`}
        aria-sort={isSorted ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <div className="flex items-center space-x-1">
          <span>{column.label}</span>
          {sortIcon && <span className="text-gray-600 dark:text-gray-300">{sortIcon}</span>}
        </div>
      </th>
    );
  }, [stickyColumns, t]);

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
              aria-label={isExpanded ? 'Dölj detaljer' : 'Visa detaljer'}
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

  // Generate row key
  const getItemRowKey = useCallback((item: T, index: number) => {
    if (getRowKey) {
      return getRowKey(item, index);
    }
    // Default: try to use ticker and companyName
    const ticker = 'ticker' in item && typeof item.ticker === 'string' ? item.ticker : '';
    const companyName = 'companyName' in item && typeof item.companyName === 'string' ? item.companyName : '';
    return `${ticker}-${companyName}-${index}`;
  }, [getRowKey]);

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
      {showHelp && enableHelp && <OnboardingHelp tableId={tableId} />}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden h-full flex flex-col transition-all duration-300 ease-in-out">
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
            {enableHelp && <HelpButton onOpenHelp={() => setShowHelp(true)} />}
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
            {headerActions}
          </div>
        </div>
        
        {/* Desktop Table View (≥1024px) */}
        <div className="hidden lg:block flex-1 overflow-auto min-h-0 sm:overflow-y-auto">
          <table 
            className="min-w-full sm:min-w-full divide-y divide-gray-300 dark:divide-gray-600"
            style={{ minWidth: minTableWidth }}
            role="table"
            aria-label={ariaLabel || tableId}
          >
            <thead className="sticky top-0 z-40 bg-gray-50 dark:bg-gray-900">
              <tr>
                {columns
                  .filter(col => isColumnVisible(col.key))
                  .map((column) => {
                    headerRenderProps.column = column;
                    const headerContent = column.renderHeader 
                      ? column.renderHeader(headerRenderProps)
                      : (renderHeader ? renderHeader(headerRenderProps) : defaultRenderHeader(headerRenderProps));
                    return <React.Fragment key={column.key}>{headerContent}</React.Fragment>;
                  })}
              </tr>
            </thead>
            {enableVirtualScroll ? (
              <VirtualTableBody
                data={displayData}
                renderRow={(item, index, globalIndex) => {
                  const rowKey = getItemRowKey(item, globalIndex);
                  const rowBgClass = globalIndex % 2 === 0 
                    ? 'bg-white dark:bg-gray-800' 
                    : 'bg-gray-50 dark:bg-gray-800';
                  
                  return (
                    <tr 
                      key={rowKey}
                      className={`group transition-all duration-300 ease-in-out hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:shadow-md cursor-pointer ${rowBgClass}`}
                    >
                      {columns
                        .filter(col => isColumnVisible(col.key))
                        .map((column) => {
                          const cellContent = column.renderCell
                            ? column.renderCell(item, column, index, globalIndex)
                            : renderCell(item, column, index, globalIndex);
                          
                          const isSticky = stickyColumns.includes(column.key);
                          const stickyClass = isSticky ? `sm:sticky ${getStickyPosition(column.key)} z-20` : '';
                          const alignClass = column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : '';
                          const bgClass = globalIndex % 2 === 0 
                            ? 'bg-white dark:bg-gray-800 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20' 
                            : 'bg-gray-50 dark:bg-gray-800 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20';
                          
                          return (
                            <td
                              key={column.key}
                              className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 transition-colors duration-200 ${stickyClass} ${alignClass} ${isSticky ? bgClass : ''}`}
                              role="gridcell"
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
                  
                  return (
                    <tr 
                      key={rowKey}
                      className={`group transition-all duration-300 ease-in-out hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:shadow-md cursor-pointer animate-fade-in ${rowBgClass}`}
                      style={{ animationDelay: `${index * 10}ms` }}
                    >
                      {columns
                        .filter(col => isColumnVisible(col.key))
                        .map((column) => {
                          const cellContent = column.renderCell
                            ? column.renderCell(item, column, index, globalIndex)
                            : renderCell(item, column, index, globalIndex);
                          
                          const isSticky = stickyColumns.includes(column.key);
                          const stickyClass = isSticky ? `sm:sticky ${getStickyPosition(column.key)} z-20` : '';
                          const alignClass = column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : '';
                          const bgClass = globalIndex % 2 === 0 
                            ? 'bg-white dark:bg-gray-800 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20' 
                            : 'bg-gray-50 dark:bg-gray-800 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20';
                          
                          return (
                            <td
                              key={column.key}
                              className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 transition-colors duration-200 ${stickyClass} ${alignClass} ${isSticky ? bgClass : ''}`}
                              role="gridcell"
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
    </>
  );
}

