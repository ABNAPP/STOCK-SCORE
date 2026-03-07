import React, { useCallback } from 'react';
import { SMAData } from '../types/stock';
import BaseTable, { ColumnDefinition, HeaderRenderProps } from './BaseTable';
import ColumnTooltip from './ColumnTooltip';
import { getColumnMetadata } from '../config/tableMetadata';
import { useTranslation } from 'react-i18next';
import { colorTypeToCssClass } from '../utils/colorThresholds';
import type { ShareableTableState } from '../types/filters';

const TABLE_ID = 'sma-100';

const SMA_COLUMNS: ColumnDefinition<SMAData>[] = [
  { key: 'antal', label: 'Antal', required: true, sticky: true, sortable: false },
  { key: 'companyName', label: 'Company Name', required: true, sticky: true, sortable: true },
  { key: 'ticker', label: 'Ticker', required: true, sticky: true, sortable: true },
  { key: 'sma9', label: 'SMA(9)', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'sma21', label: 'SMA(21)', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'sma55', label: 'SMA(55)', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'sma200', label: 'SMA(200)', defaultVisible: true, sortable: true, align: 'center' },
];

interface SMATableProps {
  data: SMAData[];
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  initialTableState?: ShareableTableState;
}

export default function SMATable({ data, loading, error, onRetry, initialTableState }: SMATableProps) {
  const { t } = useTranslation();

  const renderHeader = useCallback((props: HeaderRenderProps<SMAData>) => {
    const { column, getStickyPosition } = props;
    const metadata = getColumnMetadata(TABLE_ID, column.key);
    const isSticky = column.sticky;
    const stickyClass = isSticky ? `sm:sticky sm:top-0 ${getStickyPosition(column.key)} z-50` : '';

    return (
      <th
        className={`px-6 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider ${stickyClass} bg-gray-50 dark:bg-gray-900`}
        scope="col"
        role="columnheader"
      >
        {metadata ? (
          <ColumnTooltip metadata={metadata}>
            <span>{column.label}</span>
          </ColumnTooltip>
        ) : (
          <span>{column.label}</span>
        )}
      </th>
    );
  }, []);

  const renderSmaCell = useCallback(
    (value: number | null, color: 'GREEN' | 'RED' | null | undefined) => (
      <span
        className={
          (color === 'GREEN' ? colorTypeToCssClass('GREEN') : color === 'RED' ? colorTypeToCssClass('RED') : null) ||
          'text-black dark:text-white'
        }
      >
        {value !== null ? value.toFixed(2) : 'N/A'}
      </span>
    ),
    []
  );

  const renderCell = useCallback(
    (item: SMAData, column: ColumnDefinition<SMAData>, _index: number, globalIndex: number) => {
      switch (column.key) {
        case 'antal':
          return <span className="text-sm text-black dark:text-white">{globalIndex + 1}</span>;
        case 'companyName':
          return <span className="font-medium text-black dark:text-white">{item.companyName}</span>;
        case 'ticker':
          return <span className="text-sm text-gray-600 dark:text-gray-300">{item.ticker}</span>;
        case 'sma9':
          return renderSmaCell(item.sma9 ?? null, item.sma9Color ?? null);
        case 'sma21':
          return renderSmaCell(item.sma21 ?? null, item.sma21Color ?? null);
        case 'sma55':
          return renderSmaCell(item.sma55 ?? null, item.sma55Color ?? null);
        case 'sma200':
          return renderSmaCell(item.sma200 ?? null, item.sma200Color ?? null);
        default:
          return null;
      }
    },
    [renderSmaCell]
  );

  const renderMobileCard = useCallback(
    (item: SMAData, _index: number, globalIndex: number, isExpanded: boolean, toggleExpand: () => void) => {
      const rowBgClass =
        globalIndex % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-800/50';

      return (
        <div
          className={`${rowBgClass} rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm transition-all duration-300 ease-in-out`}
        >
          <div className="p-4 flex items-start justify-between gap-4">
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Antal
                </span>
                <span className="text-sm font-medium text-black dark:text-white">{globalIndex + 1}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Company Name
                </span>
                <span className="text-sm font-medium text-black dark:text-white text-right">
                  {item.companyName}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Ticker
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-300">{item.ticker}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">SMA(9)</span>
                <span className={(item.sma9Color === 'GREEN' ? colorTypeToCssClass('GREEN') : item.sma9Color === 'RED' ? colorTypeToCssClass('RED') : null) || 'text-sm text-black dark:text-white'}>
                  {item.sma9 !== null ? item.sma9.toFixed(2) : 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">SMA(21)</span>
                <span className={(item.sma21Color === 'GREEN' ? colorTypeToCssClass('GREEN') : item.sma21Color === 'RED' ? colorTypeToCssClass('RED') : null) || 'text-sm text-black dark:text-white'}>
                  {item.sma21 !== null ? item.sma21.toFixed(2) : 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">SMA(55)</span>
                <span className={(item.sma55Color === 'GREEN' ? colorTypeToCssClass('GREEN') : item.sma55Color === 'RED' ? colorTypeToCssClass('RED') : null) || 'text-sm text-black dark:text-white'}>
                  {item.sma55 !== null ? item.sma55.toFixed(2) : 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">SMA(200)</span>
                <span className={(item.sma200Color === 'GREEN' ? colorTypeToCssClass('GREEN') : item.sma200Color === 'RED' ? colorTypeToCssClass('RED') : null) || 'text-sm text-black dark:text-white'}>
                  {item.sma200 !== null ? item.sma200.toFixed(2) : 'N/A'}
                </span>
              </div>
            </div>
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
      );
    },
    [t]
  );

  return (
    <BaseTable<SMAData>
      data={data}
      loading={loading}
      error={error}
      columns={SMA_COLUMNS}
      filters={[]}
      tableId={TABLE_ID}
      renderCell={renderCell}
      renderHeader={renderHeader}
      renderMobileCard={renderMobileCard}
      enableVirtualScroll={true}
      virtualScrollRowHeight={52}
      virtualScrollOverscan={10}
      enableMobileExpand={false}
      searchFields={['companyName', 'ticker']}
      searchPlaceholder={t('common.search', 'Sök...')}
      defaultSortKey="companyName"
      defaultSortDirection="asc"
      stickyColumns={['antal', 'companyName', 'ticker']}
      headerCellPaddingClass="px-2 py-2"
      cellPaddingClass="px-2 py-2"
      ariaLabel={t('navigation.sma')}
      minTableWidth="100%"
      getRowKey={(item) => item.ticker}
      onRetry={onRetry}
      initialFilterState={initialTableState?.filterState}
      initialColumnFilters={initialTableState?.columnFilters}
      initialSearchValue={initialTableState?.searchValue}
      initialSortConfig={initialTableState?.sortConfig}
    />
  );
}
