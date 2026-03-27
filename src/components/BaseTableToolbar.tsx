/**
 * Toolbar for BaseTable: search, column visibility, export, print, share, custom actions.
 * Refactored out of BaseTable for maintainability (refactor-only, no behavior change).
 */

import React, { ReactNode } from 'react';
import TableSearchBar from './TableSearchBar';
import ColumnVisibilityToggle from './ColumnVisibilityToggle';

export interface BaseTableToolbarProps<T = unknown> {
  searchValue: string;
  onSearchChange: (value: string) => void;
  totalRows: number;
  filteredRows: number;
  searchPlaceholder?: string;
  columns: Array<{ key: string; label: string }>;
  columnVisibility: Record<string, boolean>;
  onToggleColumn: (key: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
  onResetToDefaults: () => void;
  isColumnVisible: (key: string) => boolean;
  headerActions?: ReactNode | ((api: { toggleColumn: (key: string) => void; isColumnVisible: (key: string) => boolean }) => ReactNode);
}

export default function BaseTableToolbar<T = unknown>({
  searchValue,
  onSearchChange,
  totalRows,
  filteredRows,
  searchPlaceholder = 'Sök...',
  columns,
  columnVisibility,
  onToggleColumn,
  onShowAll,
  onHideAll,
  onResetToDefaults,
  isColumnVisible,
  headerActions,
}: BaseTableToolbarProps<T>) {
  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-300 dark:border-gray-500 px-4 py-3 flex items-center justify-between gap-4 flex-shrink-0">
      <div className="flex-1">
        <TableSearchBar
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          totalRows={totalRows}
          filteredRows={filteredRows}
          placeholder={searchPlaceholder}
        />
      </div>
      <div className="flex items-center gap-2">
        <ColumnVisibilityToggle
          columns={columns}
          columnVisibility={columnVisibility}
          onToggleColumn={onToggleColumn}
          onShowAll={onShowAll}
          onHideAll={onHideAll}
          onReset={onResetToDefaults}
          isColumnVisible={isColumnVisible}
        />
        {typeof headerActions === 'function' ? headerActions({ toggleColumn: onToggleColumn, isColumnVisible }) : headerActions}
      </div>
    </div>
  );
}
