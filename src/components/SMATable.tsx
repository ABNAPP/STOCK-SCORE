import React, { useCallback } from 'react';
import { SMAData } from '../types/stock';
import BaseTable, { ColumnDefinition, HeaderRenderProps } from './BaseTable';
import ColumnTooltip from './ColumnTooltip';
import { getColumnMetadata } from '../config/tableMetadata';
import { FilterConfig } from './AdvancedFilters';
import { useTranslation } from 'react-i18next';

interface SMATableProps {
  data: SMAData[];
  loading: boolean;
  error: string | null;
}

const SMA_COLUMNS: ColumnDefinition<SMAData>[] = [
  { key: 'antal', label: 'Antal', required: true, sticky: true, sortable: false },
  { key: 'companyName', label: 'Company Name', required: true, sticky: true, sortable: true },
  { key: 'ticker', label: 'Ticker', required: true, sticky: true, sortable: true },
  { key: 'sma100', label: 'SMA(100)', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'sma200', label: 'SMA(200)', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'smaCross', label: 'SMA Cross', defaultVisible: true, sortable: true, align: 'center' },
];

const SMA_FILTERS: FilterConfig[] = [
  {
    key: 'companyName',
    label: 'Företagsnamn',
    type: 'text',
  },
  {
    key: 'ticker',
    label: 'Ticker',
    type: 'text',
  },
  {
    key: 'sma100',
    label: 'SMA(100)',
    type: 'numberRange',
    min: 0,
    step: 0.01,
  },
  {
    key: 'sma200',
    label: 'SMA(200)',
    type: 'numberRange',
    min: 0,
    step: 0.01,
  },
  {
    key: 'smaCross',
    label: 'SMA Cross',
    type: 'select',
    options: [
      { value: 'GOLDEN', label: 'Golden' },
      { value: 'DEATH', label: 'Death' },
      { value: 'NONE', label: 'None' },
    ],
  },
];

export default function SMATable({ data, loading, error }: SMATableProps) {
  const { t } = useTranslation();

  // Custom header renderer with ColumnTooltip
  const renderHeader = useCallback((props: HeaderRenderProps<SMAData>) => {
    const { column, sortConfig, handleSort, getSortIcon, getStickyPosition, isColumnVisible } = props;
    const metadata = getColumnMetadata('sma-100', column.key);
    const isSticky = column.sticky;
    const sortIcon = getSortIcon(column.key);
    const stickyClass = isSticky ? `sm:sticky sm:top-0 ${getStickyPosition(column.key)} z-50` : '';
    
    if (!column.sortable) {
      const headerContent = (
        <th
          className={`px-6 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider ${stickyClass} bg-gray-50 dark:bg-gray-900`}
          scope="col"
          role="columnheader"
        >
          {metadata ? (
            <ColumnTooltip metadata={metadata}>
              <div className="flex items-center space-x-1">
                <span>{column.label}</span>
              </div>
            </ColumnTooltip>
          ) : (
            <div className="flex items-center space-x-1">
              <span>{column.label}</span>
            </div>
          )}
        </th>
      );
      return <React.Fragment key={column.key}>{headerContent}</React.Fragment>;
    }

    const headerContent = (
      <th
        onClick={() => handleSort(column.key)}
        className={`px-6 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-200 transition-all duration-200 ${stickyClass} bg-gray-50 dark:bg-gray-900`}
        scope="col"
        role="columnheader"
      >
        {metadata ? (
          <ColumnTooltip metadata={metadata}>
            <div className="flex items-center space-x-1">
              <span>{column.label}</span>
              {sortIcon && <span className="text-gray-600 dark:text-gray-300">{sortIcon}</span>}
            </div>
          </ColumnTooltip>
        ) : (
          <div className="flex items-center space-x-1">
            <span>{column.label}</span>
            {sortIcon && <span className="text-gray-400 dark:text-gray-300">{sortIcon}</span>}
          </div>
        )}
      </th>
    );
    return <React.Fragment key={column.key}>{headerContent}</React.Fragment>;
  }, []);

  // Render cell content
  const renderCell = useCallback((item: SMAData, column: ColumnDefinition<SMAData>, index: number, globalIndex: number) => {
    switch (column.key) {
      case 'antal':
        return globalIndex + 1;
      case 'companyName':
        return <span className="font-medium">{item.companyName}</span>;
      case 'ticker':
        return <span className="text-gray-600 dark:text-gray-300">{item.ticker}</span>;
      case 'sma100':
        return <span className="text-gray-900 dark:text-gray-100">{item.sma100 !== null ? item.sma100.toLocaleString() : 'N/A'}</span>;
      case 'sma200':
        return <span className="text-gray-900 dark:text-gray-100">{item.sma200 !== null ? item.sma200.toLocaleString() : 'N/A'}</span>;
      case 'smaCross':
        return (
          <span className={
            item.smaCross && item.smaCross.toUpperCase().includes('GOLDEN')
              ? 'text-red-700 dark:text-red-400'
              : item.smaCross && item.smaCross.toUpperCase().includes('DEATH')
              ? 'text-green-600 dark:text-green-300'
              : item.smaCross && item.smaCross.trim() !== ''
              ? 'text-blue-700 dark:text-blue-300'
              : 'text-gray-900 dark:text-gray-100'
          }>
            {item.smaCross || 'N/A'}
          </span>
        );
      default:
        return null;
    }
  }, []);

  // Render mobile card
  const renderMobileCard = useCallback((item: SMAData, index: number, globalIndex: number, isExpanded: boolean, toggleExpand: () => void) => {
    const rowKey = `${item.ticker}-${item.companyName}-${globalIndex}`;
    const rowBgClass = globalIndex % 2 === 0 
      ? 'bg-white dark:bg-gray-800' 
      : 'bg-gray-50 dark:bg-gray-800';

    return (
      <div
        key={rowKey}
        className={`${rowBgClass} rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm transition-all duration-300 ease-in-out`}
      >
        {/* Primary Columns - Always Visible */}
        <div className="p-4 flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Antal</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{globalIndex + 1}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Company Name</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100 text-right">{item.companyName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Ticker</span>
              <span className="text-sm text-gray-600 dark:text-gray-300">{item.ticker}</span>
            </div>
          </div>
          {/* Expand/Collapse Button */}
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
        </div>

        {/* Secondary Columns - Expandable */}
        {isExpanded && (
          <div className="border-t border-gray-300 dark:border-gray-600 p-4 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">SMA(100)</span>
              <span className="text-sm text-gray-900 dark:text-gray-100">
                {item.sma100 !== null ? item.sma100.toLocaleString() : 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">SMA(200)</span>
              <span className="text-sm text-gray-900 dark:text-gray-100">
                {item.sma200 !== null ? item.sma200.toLocaleString() : 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">SMA Cross</span>
              <span className={`text-sm ${
                item.smaCross && item.smaCross.toUpperCase().includes('GOLDEN')
                  ? 'text-red-700 dark:text-red-500'
                  : item.smaCross && item.smaCross.toUpperCase().includes('DEATH')
                  ? 'text-green-600 dark:text-green-400'
                  : item.smaCross && item.smaCross.trim() !== ''
                  ? 'text-blue-700 dark:text-blue-400'
                  : 'text-gray-900 dark:text-gray-100'
              }`}>
                {item.smaCross || 'N/A'}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }, []);

  return (
    <BaseTable<SMAData>
      data={data}
      loading={loading}
      error={error}
      columns={SMA_COLUMNS}
      filters={SMA_FILTERS}
      tableId="sma"
      renderCell={renderCell}
      renderHeader={renderHeader}
      renderMobileCard={renderMobileCard}
      enableVirtualScroll={true}
      virtualScrollRowHeight={60}
      virtualScrollOverscan={10}
      enableMobileExpand={true}
      searchFields={['companyName', 'ticker']}
      searchPlaceholder="Sök efter företag eller ticker..."
      defaultSortKey="companyName"
      defaultSortDirection="asc"
      stickyColumns={['antal', 'companyName', 'ticker']}
      ariaLabel="SMA"
      minTableWidth="800px"
      getRowKey={(item, index) => `${item.ticker}-${item.companyName}-${index}`}
    />
  );
}
