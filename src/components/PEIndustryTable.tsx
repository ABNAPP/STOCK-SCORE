import React, { useMemo, useCallback } from 'react';
import { PEIndustryData } from '../types/stock';
import BaseTable, { ColumnDefinition, HeaderRenderProps } from './BaseTable';
import ColumnTooltip from './ColumnTooltip';
import { getColumnMetadata } from '../config/tableMetadata';
import { FilterConfig } from './AdvancedFilters';
import { useTranslation } from 'react-i18next';

interface PEIndustryTableProps {
  data: PEIndustryData[];
  loading: boolean;
  error: string | null;
}

const PE_INDUSTRY_COLUMNS: ColumnDefinition<PEIndustryData>[] = [
  { key: 'antal', label: 'Antal', required: true, sticky: true, sortable: false },
  { key: 'industry', label: 'Industry', required: true, sticky: true, sortable: true },
  { key: 'pe', label: 'P/E INDUSTRY', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'pe1', label: 'P/E1 INDUSTRY', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'pe2', label: 'P/E2 INDUSTRY', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'companyCount', label: 'Antal bolag', defaultVisible: true, sortable: true, align: 'center' },
];

export default function PEIndustryTable({ data, loading, error }: PEIndustryTableProps) {
  const { t } = useTranslation();
  
  // Get unique industries for filter dropdown
  const uniqueIndustries = useMemo(() => {
    const industries = new Set<string>();
    data.forEach((item) => {
      if (item.industry && item.industry.trim()) {
        industries.add(item.industry);
      }
    });
    return Array.from(industries).sort().map((ind) => ({ value: ind, label: ind }));
  }, [data]);

  const peIndustryFilters: FilterConfig[] = useMemo(() => [
    {
      key: 'industry',
      label: 'Industri',
      type: 'select',
      options: uniqueIndustries,
    },
    {
      key: 'pe',
      label: 'P/E INDUSTRY',
      type: 'numberRange',
      step: 0.1,
    },
    {
      key: 'pe1',
      label: 'P/E1 INDUSTRY',
      type: 'numberRange',
      step: 0.1,
    },
    {
      key: 'pe2',
      label: 'P/E2 INDUSTRY',
      type: 'numberRange',
      step: 0.1,
    },
    {
      key: 'companyCount',
      label: 'Antal bolag',
      type: 'numberRange',
      min: 0,
      step: 1,
    },
  ], [uniqueIndustries]);

  // Custom header renderer with ColumnTooltip
  const renderHeader = useCallback((props: HeaderRenderProps<PEIndustryData>) => {
    const { column, sortConfig, handleSort, getSortIcon, getStickyPosition, isColumnVisible } = props;
    const metadata = getColumnMetadata('pe-industry', column.key);
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
  const renderCell = useCallback((item: PEIndustryData, column: ColumnDefinition<PEIndustryData>, index: number, globalIndex: number) => {
    switch (column.key) {
      case 'antal':
        return globalIndex + 1;
      case 'industry':
        return <span className="font-medium">{item.industry}</span>;
      case 'pe':
        return <span className="text-gray-900 dark:text-gray-100">{item.pe !== null ? item.pe.toFixed(2) : 'N/A'}</span>;
      case 'pe1':
        return <span className="text-gray-900 dark:text-gray-100">{item.pe1 !== null ? item.pe1.toFixed(2) : 'N/A'}</span>;
      case 'pe2':
        return <span className="text-gray-900 dark:text-gray-100">{item.pe2 !== null ? item.pe2.toFixed(2) : 'N/A'}</span>;
      case 'companyCount':
        return <span className="text-gray-900 dark:text-gray-100">{item.companyCount}</span>;
      default:
        return null;
    }
  }, []);

  // Render mobile card
  const renderMobileCard = useCallback((item: PEIndustryData, index: number, globalIndex: number, isExpanded: boolean, toggleExpand: () => void) => {
    const rowKey = `${item.industry}-${globalIndex}`;
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
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Industry</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100 text-right">{item.industry}</span>
            </div>
          </div>
          {/* Expand/Collapse Button */}
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
        </div>

        {/* Secondary Columns - Expandable */}
        {isExpanded && (
          <div className="border-t border-gray-300 dark:border-gray-600 p-4 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">P/E INDUSTRY</span>
              <span className="text-sm text-gray-900 dark:text-gray-100">
                {item.pe !== null ? item.pe.toFixed(2) : 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">P/E1 INDUSTRY</span>
              <span className="text-sm text-gray-900 dark:text-gray-100">
                {item.pe1 !== null ? item.pe1.toFixed(2) : 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">P/E2 INDUSTRY</span>
              <span className="text-sm text-gray-900 dark:text-gray-100">
                {item.pe2 !== null ? item.pe2.toFixed(2) : 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Antal bolag</span>
              <span className="text-sm text-gray-900 dark:text-gray-100">
                {item.companyCount}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }, []);

  return (
    <BaseTable<PEIndustryData>
      data={data}
      loading={loading}
      error={error}
      columns={PE_INDUSTRY_COLUMNS}
      filters={peIndustryFilters}
      tableId="pe-industry"
      renderCell={renderCell}
      renderHeader={renderHeader}
      renderMobileCard={renderMobileCard}
      enableVirtualScroll={true}
      virtualScrollRowHeight={60}
      virtualScrollOverscan={10}
      enableMobileExpand={true}
      enableQuickFilters={false}
      searchFields={['industry']}
      searchPlaceholder="Sök efter bransch..."
      defaultSortKey="companyCount"
      defaultSortDirection="desc"
      stickyColumns={['antal', 'industry']}
      ariaLabel="P/E Industry"
      minTableWidth="800px"
      getRowKey={(item, index) => `${item.industry}-${index}`}
    />
  );
}
