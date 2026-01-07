import React, { useState, useCallback, useMemo } from 'react';
import { BenjaminGrahamData } from '../types/stock';
import BaseTable, { ColumnDefinition, HeaderRenderProps } from './BaseTable';
import ColumnTooltip from './ColumnTooltip';
import { getColumnMetadata } from '../config/tableMetadata';
import { FilterConfig } from './AdvancedFilters';
import { useTranslation } from 'react-i18next';
import { useEntryExitValues } from '../contexts/EntryExitContext';
import {
  PRICE_TOLERANCE_GREEN,
  PRICE_TOLERANCE_BLUE,
  RR1_GREEN_THRESHOLD_PERCENT,
  RR2_GREEN_THRESHOLD_PERCENT,
} from '../config/constants';

interface BenjaminGrahamTableProps {
  data: BenjaminGrahamData[];
  loading: boolean;
  error: string | null;
}

const BENJAMIN_GRAHAM_COLUMNS: ColumnDefinition<BenjaminGrahamData>[] = [
  { key: 'antal', label: 'Antal', required: true, sticky: true, sortable: false },
  { key: 'companyName', label: 'Company Name', required: true, sticky: true, sortable: true },
  { key: 'ticker', label: 'Ticker', required: true, sticky: true, sortable: true },
  { key: 'price', label: 'Price', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'benjaminGraham', label: 'Benjamin Graham', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'ivFcf', label: 'IV (FCF)', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'irr1', label: 'RR1', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'rr2', label: 'RR2', defaultVisible: true, sortable: false, align: 'center' },
];

const BENJAMIN_GRAHAM_FILTERS: FilterConfig[] = [
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
    key: 'price',
    label: 'Pris',
    type: 'numberRange',
    min: 0,
    step: 0.01,
  },
  {
    key: 'benjaminGraham',
    label: 'Benjamin Graham',
    type: 'numberRange',
    min: 0,
    step: 0.01,
  },
  {
    key: 'ivFcf',
    label: 'IV (FCF)',
    type: 'numberRange',
    min: 0,
    step: 0.01,
  },
];

export default function BenjaminGrahamTable({ data, loading, error }: BenjaminGrahamTableProps) {
  const { t } = useTranslation();
  const [expandedRows, setExpandedRows] = useState<{ [key: string]: boolean }>({});
  const { getEntryExitValue } = useEntryExitValues();

  // Check if ivFcf column should be shown
  const hasIvFcf = useMemo(() => {
    return data.some(item => item.ivFcf !== undefined);
  }, [data]);

  // Calculate RR1: (Exit1 - Entry1) / Entry1 * 100
  const calculateRR1 = useCallback((entry1: number, exit1: number): number | null => {
    if (!entry1 || !exit1 || entry1 === 0) return null;
    const rr1 = ((exit1 - entry1) / entry1) * 100;
    return isNaN(rr1) || !isFinite(rr1) ? null : rr1;
  }, []);

  // Get color for RR1 cell based on conditions
  const getRR1Color = useCallback((rr1: number | null, price: number | null, entry1: number): string | null => {
    if (rr1 !== null && rr1 > RR1_GREEN_THRESHOLD_PERCENT && price !== null && price > 0 && entry1 > 0 && price <= entry1 * PRICE_TOLERANCE_GREEN) {
      return 'text-green-600 dark:text-green-300 bg-green-50 dark:bg-green-900/20';
    }
    return null;
  }, []);

  // Calculate RR2: (Exit2 - Entry2) / Entry2 * 100
  const calculateRR2 = useCallback((entry2: number, exit2: number): number | null => {
    if (!entry2 || !exit2 || entry2 === 0) return null;
    const rr2 = ((exit2 - entry2) / entry2) * 100;
    return isNaN(rr2) || !isFinite(rr2) ? null : rr2;
  }, []);

  // Get color for RR2 cell based on conditions
  const getRR2Color = useCallback((rr2: number | null, price: number | null, entry2: number): string | null => {
    if (rr2 !== null && rr2 >= RR2_GREEN_THRESHOLD_PERCENT && price !== null && price > 0 && entry2 > 0 && price <= entry2 * PRICE_TOLERANCE_GREEN) {
      return 'text-green-600 dark:text-green-300 bg-green-50 dark:bg-green-900/20';
    }
    return null;
  }, []);

  // Custom header renderer with ColumnTooltip
  const renderHeader = useCallback((props: HeaderRenderProps<BenjaminGrahamData>) => {
    const { column, sortConfig, handleSort, getSortIcon, getStickyPosition, isColumnVisible } = props;
    const metadata = getColumnMetadata('benjamin-graham', column.key);
    const isSticky = column.sticky;
    const isSorted = sortConfig.key === column.key;
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
            {sortIcon && <span className="text-gray-600 dark:text-gray-300">{sortIcon}</span>}
          </div>
        )}
      </th>
    );
    return <React.Fragment key={column.key}>{headerContent}</React.Fragment>;
  }, []);

  // Render cell content
  const renderCell = useCallback((item: BenjaminGrahamData, column: ColumnDefinition<BenjaminGrahamData>, index: number, globalIndex: number) => {
    switch (column.key) {
      case 'antal':
        return globalIndex + 1;
      case 'companyName':
        return <span className="font-medium">{item.companyName}</span>;
      case 'ticker':
        return <span className="text-gray-600 dark:text-gray-300">{item.ticker}</span>;
      case 'price':
        return <span className="text-gray-900 dark:text-gray-100">{item.price !== null ? item.price.toLocaleString() : 'N/A'}</span>;
      case 'benjaminGraham':
        return (
          <span className={
            item.benjaminGraham === null
              ? 'text-gray-900 dark:text-gray-100'
              : item.benjaminGraham < 0 
              ? 'text-red-700 dark:text-red-400'
              : item.benjaminGraham > 0 && 
                item.price !== null && item.price > 0 && 
                item.price <= item.benjaminGraham * PRICE_TOLERANCE_GREEN
              ? 'text-green-600 dark:text-green-300'
              : item.benjaminGraham > 0 && 
                item.price !== null && item.price > 0 && 
                item.price <= item.benjaminGraham * PRICE_TOLERANCE_BLUE
              ? 'text-blue-700 dark:text-blue-300'
              : 'text-gray-900 dark:text-gray-100'
          }>
            {item.benjaminGraham !== null ? item.benjaminGraham.toLocaleString() : 'N/A'}
          </span>
        );
      case 'ivFcf':
        if (!hasIvFcf) return null;
        return <span className="text-gray-900 dark:text-gray-100">{item.ivFcf !== null && item.ivFcf !== undefined ? item.ivFcf.toLocaleString() : 'N/A'}</span>;
      case 'irr1':
        {
          const entryExitValues = getEntryExitValue(item.ticker, item.companyName);
          const entry1 = entryExitValues?.entry1 || 0;
          const exit1 = entryExitValues?.exit1 || 0;
          const rr1 = calculateRR1(entry1, exit1);
          const colorClass = getRR1Color(rr1, item.price, entry1);
          return (
            <span className={colorClass || 'text-gray-900 dark:text-gray-100'}>
              {rr1 !== null ? `${Math.round(rr1)}%` : 'N/A'}
            </span>
          );
        }
      case 'rr2':
        {
          const entryExitValues = getEntryExitValue(item.ticker, item.companyName);
          const entry2 = entryExitValues?.entry2 || 0;
          const exit2 = entryExitValues?.exit2 || 0;
          const rr2 = calculateRR2(entry2, exit2);
          const colorClass = getRR2Color(rr2, item.price, entry2);
          return (
            <span className={colorClass || 'text-gray-900 dark:text-gray-100'}>
              {rr2 !== null ? `${Math.round(rr2)}%` : 'N/A'}
            </span>
          );
        }
      default:
        return null;
    }
  }, [getEntryExitValue, calculateRR1, calculateRR2, getRR1Color, getRR2Color, hasIvFcf]);

  // Render mobile card
  const renderMobileCard = useCallback((item: BenjaminGrahamData, index: number, globalIndex: number, isExpanded: boolean, toggleExpand: () => void) => {
    const rowKey = `${item.ticker}-${item.companyName}-${globalIndex}`;
    const rowBgClass = globalIndex % 2 === 0 
      ? 'bg-white dark:bg-gray-800' 
      : 'bg-gray-50 dark:bg-gray-800/50';

    const entryExitValues = getEntryExitValue(item.ticker, item.companyName);
    const entry1 = entryExitValues?.entry1 || 0;
    const exit1 = entryExitValues?.exit1 || 0;
    const entry2 = entryExitValues?.entry2 || 0;
    const exit2 = entryExitValues?.exit2 || 0;
    const rr1 = calculateRR1(entry1, exit1);
    const rr2 = calculateRR2(entry2, exit2);
    const rr1Color = getRR1Color(rr1, item.price, entry1);
    const rr2Color = getRR2Color(rr2, item.price, entry2);

    return (
      <div
        key={rowKey}
        className={`${rowBgClass} rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm transition-all duration-300 ease-in-out`}
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
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Price</span>
              <span className="text-sm text-gray-900 dark:text-gray-100">
                {item.price !== null ? item.price.toLocaleString() : 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Benjamin Graham</span>
              <span className={`text-sm text-center ${
                item.benjaminGraham === null
                  ? 'text-gray-900 dark:text-gray-100'
                  : item.benjaminGraham < 0 
                  ? 'text-red-700 dark:text-red-300'
                  : item.benjaminGraham > 0 && 
                    item.price !== null && item.price > 0 && 
                    item.price <= item.benjaminGraham * PRICE_TOLERANCE_GREEN
                  ? 'text-green-600 dark:text-green-300'
                  : item.benjaminGraham > 0 && 
                    item.price !== null && item.price > 0 && 
                    item.price <= item.benjaminGraham * PRICE_TOLERANCE_BLUE
                  ? 'text-blue-700 dark:text-blue-300'
                  : 'text-gray-900 dark:text-gray-100'
              }`}>
                {item.benjaminGraham !== null ? item.benjaminGraham.toLocaleString() : 'N/A'}
              </span>
            </div>
            {hasIvFcf && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">IV (FCF)</span>
                <span className="text-sm text-gray-900 dark:text-gray-100">
                  {item.ivFcf !== null && item.ivFcf !== undefined ? item.ivFcf.toLocaleString() : 'N/A'}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">RR1</span>
              <span className={`text-sm ${rr1Color || 'text-gray-900 dark:text-gray-100'}`}>
                {rr1 !== null ? `${Math.round(rr1)}%` : 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">RR2</span>
              <span className={`text-sm ${rr2Color || 'text-gray-900 dark:text-gray-100'}`}>
                {rr2 !== null ? `${Math.round(rr2)}%` : 'N/A'}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }, [getEntryExitValue, calculateRR1, calculateRR2, getRR1Color, getRR2Color, hasIvFcf]);

  // Filter columns based on ivFcf availability
  const filteredColumns = useMemo(() => {
    if (hasIvFcf) {
      return BENJAMIN_GRAHAM_COLUMNS;
    }
    return BENJAMIN_GRAHAM_COLUMNS.filter(col => col.key !== 'ivFcf');
  }, [hasIvFcf]);

  return (
    <BaseTable<BenjaminGrahamData>
      data={data}
      loading={loading}
      error={error}
      columns={filteredColumns}
      filters={BENJAMIN_GRAHAM_FILTERS}
      tableId="benjamin-graham"
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
      ariaLabel="Benjamin Graham"
      minTableWidth="800px"
      getRowKey={(item, index) => `${item.ticker}-${item.companyName}-${index}`}
    />
  );
}
