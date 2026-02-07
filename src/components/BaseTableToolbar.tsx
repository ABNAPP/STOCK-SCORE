/**
 * Toolbar for BaseTable: search, column visibility, export, print, share, custom actions.
 * Refactored out of BaseTable for maintainability (refactor-only, no behavior change).
 */

import React, { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import TableSearchBar from './TableSearchBar';
import ColumnVisibilityToggle from './ColumnVisibilityToggle';
import Button from './ui/Button';

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
  enableExport?: boolean;
  sortedRowCount: number;
  onExportCsv: () => void;
  onExportExcel: () => void;
  enablePrint?: boolean;
  onPrint: () => void;
  enableShareableLink?: boolean;
  hasCurrentUser: boolean;
  viewId?: string;
  onOpenShareableLink: () => void;
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
  enableExport = false,
  sortedRowCount,
  onExportCsv,
  onExportExcel,
  enablePrint = false,
  onPrint,
  enableShareableLink = false,
  hasCurrentUser,
  viewId,
  onOpenShareableLink,
  headerActions,
}: BaseTableToolbarProps<T>) {
  const { t } = useTranslation();

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
        {enableExport && sortedRowCount > 0 && (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={onExportCsv}
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
              onClick={onExportExcel}
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
            onClick={onPrint}
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
        {enableShareableLink && hasCurrentUser && viewId && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenShareableLink}
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
        {typeof headerActions === 'function' ? headerActions({ toggleColumn: onToggleColumn, isColumnVisible }) : headerActions}
      </div>
    </div>
  );
}
