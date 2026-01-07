import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ThresholdIndustryData } from '../types/stock';
import BaseTable, { ColumnDefinition, HeaderRenderProps } from './BaseTable';
import ColumnTooltip from './ColumnTooltip';
import { getColumnMetadata } from '../config/tableMetadata';
import { FilterConfig } from './AdvancedFilters';
import { useTranslation } from 'react-i18next';

interface ThresholdIndustryTableProps {
  data: ThresholdIndustryData[];
  loading: boolean;
  error: string | null;
}

interface ThresholdValues {
  irr: number;
  leverageF2Min: number;
  leverageF2Max: number;
  ro40Min: number;
  ro40Max: number;
  cashSdebtMin: number;
  cashSdebtMax: number;
  currentRatioMin: number;
  currentRatioMax: number;
}

const THRESHOLD_INDUSTRY_COLUMNS: ColumnDefinition<ThresholdIndustryData>[] = [
  { key: 'antal', label: 'Antal', required: true, sticky: true, sortable: false },
  { key: 'industry', label: 'INDUSTRY', required: true, sticky: true, sortable: true },
  { key: 'irr', label: 'IRR', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'leverageF2Min', label: 'LEVERAGE F2 MIN', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'leverageF2Max', label: 'LEVERAGE F2 MAX', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'ro40Min', label: 'RO40 MIN', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'ro40Max', label: 'RO40 MAX', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'cashSdebtMin', label: 'Cash/SDebt MIN', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'cashSdebtMax', label: 'Cash/SDebt MAX', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'currentRatioMin', label: 'Current Ratio MIN', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'currentRatioMax', label: 'Current Ratio MAX', defaultVisible: true, sortable: true, align: 'center' },
];

export default function ThresholdIndustryTable({ data, loading, error }: ThresholdIndustryTableProps) {
  const { t } = useTranslation();
  const [thresholdValues, setThresholdValues] = useState<Map<string, ThresholdValues>>(new Map());

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

  const thresholdFilters: FilterConfig[] = useMemo(() => [
    {
      key: 'industry',
      label: 'Industri',
      type: 'select',
      options: uniqueIndustries,
    },
    {
      key: 'irr',
      label: 'IRR',
      type: 'numberRange',
      step: 0.1,
    },
    {
      key: 'leverageF2Min',
      label: 'Leverage F2 Min',
      type: 'numberRange',
      step: 0.01,
    },
    {
      key: 'leverageF2Max',
      label: 'Leverage F2 Max',
      type: 'numberRange',
      step: 0.01,
    },
    {
      key: 'ro40Min',
      label: 'Ro40 Min',
      type: 'numberRange',
      step: 0.1,
    },
    {
      key: 'ro40Max',
      label: 'Ro40 Max',
      type: 'numberRange',
      step: 0.1,
    },
  ], [uniqueIndustries]);

  // Initialize threshold values from data
  useEffect(() => {
    setThresholdValues((prev) => {
      const newMap = new Map(prev);
      data.forEach((item) => {
        if (!newMap.has(item.industry)) {
          newMap.set(item.industry, {
            irr: item.irr || 0,
            leverageF2Min: item.leverageF2Min || 0,
            leverageF2Max: item.leverageF2Max || 0,
            ro40Min: item.ro40Min || 0,
            ro40Max: item.ro40Max || 0,
            cashSdebtMin: item.cashSdebtMin || 0,
            cashSdebtMax: item.cashSdebtMax || 0,
            currentRatioMin: item.currentRatioMin || 0,
            currentRatioMax: item.currentRatioMax || 0,
          });
        }
      });
      return newMap;
    });
  }, [data]);

  const handleThresholdChange = useCallback((industry: string, field: keyof ThresholdValues, value: number) => {
    setThresholdValues((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(industry) || { irr: 0, leverageF2Min: 0, leverageF2Max: 0, ro40Min: 0, ro40Max: 0, cashSdebtMin: 0, cashSdebtMax: 0, currentRatioMin: 0, currentRatioMax: 0 };
      newMap.set(industry, {
        ...current,
        [field]: value,
      });
      return newMap;
    });
  }, []);

  // Custom header renderer with ColumnTooltip
  const renderHeader = useCallback((props: HeaderRenderProps<ThresholdIndustryData>) => {
    const { column, sortConfig, handleSort, getSortIcon, getStickyPosition, isColumnVisible } = props;
    const metadata = getColumnMetadata('threshold-industry', column.key);
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

  // Render cell content with editable inputs
  const renderCell = useCallback((item: ThresholdIndustryData, column: ColumnDefinition<ThresholdIndustryData>, index: number, globalIndex: number) => {
    const values = thresholdValues.get(item.industry) || {
      irr: item.irr || 0,
      leverageF2Min: item.leverageF2Min || 0,
      leverageF2Max: item.leverageF2Max || 0,
      ro40Min: item.ro40Min || 0,
      ro40Max: item.ro40Max || 0,
      cashSdebtMin: item.cashSdebtMin || 0,
      cashSdebtMax: item.cashSdebtMax || 0,
      currentRatioMin: item.currentRatioMin || 0,
      currentRatioMax: item.currentRatioMax || 0,
    };

    switch (column.key) {
      case 'antal':
        return globalIndex + 1;
      case 'industry':
        return <span className="font-medium">{item.industry}</span>;
      case 'irr':
        return (
          <input
            type="number"
            step="0.1"
            value={values.irr || ''}
            onChange={(e) => {
              const value = parseFloat(e.target.value) || 0;
              handleThresholdChange(item.industry, 'irr', value);
            }}
            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-24 text-center"
            onClick={(e) => e.stopPropagation()}
          />
        );
      case 'leverageF2Min':
        return (
          <input
            type="number"
            step="0.1"
            value={values.leverageF2Min || ''}
            onChange={(e) => {
              const value = parseFloat(e.target.value) || 0;
              handleThresholdChange(item.industry, 'leverageF2Min', value);
            }}
            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-24 text-center"
            onClick={(e) => e.stopPropagation()}
          />
        );
      case 'leverageF2Max':
        return (
          <input
            type="number"
            step="0.1"
            value={values.leverageF2Max || ''}
            onChange={(e) => {
              const value = parseFloat(e.target.value) || 0;
              handleThresholdChange(item.industry, 'leverageF2Max', value);
            }}
            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-24 text-center"
            onClick={(e) => e.stopPropagation()}
          />
        );
      case 'ro40Min':
        return (
          <input
            type="number"
            step="0.01"
            value={values.ro40Min || ''}
            onChange={(e) => {
              const value = parseFloat(e.target.value) || 0;
              handleThresholdChange(item.industry, 'ro40Min', value);
            }}
            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-24 text-center"
            onClick={(e) => e.stopPropagation()}
          />
        );
      case 'ro40Max':
        return (
          <input
            type="number"
            step="0.01"
            value={values.ro40Max || ''}
            onChange={(e) => {
              const value = parseFloat(e.target.value) || 0;
              handleThresholdChange(item.industry, 'ro40Max', value);
            }}
            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-24 text-center"
            onClick={(e) => e.stopPropagation()}
          />
        );
      case 'cashSdebtMin':
        return (
          <input
            type="number"
            step="0.1"
            value={values.cashSdebtMin || ''}
            onChange={(e) => {
              const value = parseFloat(e.target.value) || 0;
              handleThresholdChange(item.industry, 'cashSdebtMin', value);
            }}
            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-24 text-center"
            onClick={(e) => e.stopPropagation()}
          />
        );
      case 'cashSdebtMax':
        return (
          <input
            type="number"
            step="0.1"
            value={values.cashSdebtMax || ''}
            onChange={(e) => {
              const value = parseFloat(e.target.value) || 0;
              handleThresholdChange(item.industry, 'cashSdebtMax', value);
            }}
            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-24 text-center"
            onClick={(e) => e.stopPropagation()}
          />
        );
      case 'currentRatioMin':
        return (
          <input
            type="number"
            step="0.1"
            value={values.currentRatioMin || ''}
            onChange={(e) => {
              const value = parseFloat(e.target.value) || 0;
              handleThresholdChange(item.industry, 'currentRatioMin', value);
            }}
            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-24 text-center"
            onClick={(e) => e.stopPropagation()}
          />
        );
      case 'currentRatioMax':
        return (
          <input
            type="number"
            step="0.1"
            value={values.currentRatioMax || ''}
            onChange={(e) => {
              const value = parseFloat(e.target.value) || 0;
              handleThresholdChange(item.industry, 'currentRatioMax', value);
            }}
            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-24 text-center"
            onClick={(e) => e.stopPropagation()}
          />
        );
      default:
        return null;
    }
  }, [thresholdValues, handleThresholdChange]);

  // Render mobile card
  const renderMobileCard = useCallback((item: ThresholdIndustryData, index: number, globalIndex: number, isExpanded: boolean, toggleExpand: () => void) => {
    const rowKey = `${item.industry}-${globalIndex}`;
    const rowBgClass = globalIndex % 2 === 0 
      ? 'bg-white dark:bg-gray-800' 
      : 'bg-gray-50 dark:bg-gray-800/50';
    
    const values = thresholdValues.get(item.industry) || {
      irr: item.irr || 0,
      leverageF2Min: item.leverageF2Min || 0,
      leverageF2Max: item.leverageF2Max || 0,
      ro40Min: item.ro40Min || 0,
      ro40Max: item.ro40Max || 0,
      cashSdebtMin: item.cashSdebtMin || 0,
      cashSdebtMax: item.cashSdebtMax || 0,
      currentRatioMin: item.currentRatioMin || 0,
      currentRatioMax: item.currentRatioMax || 0,
    };

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
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">INDUSTRY</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100 text-right">{item.industry}</span>
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
            {Object.entries({
              irr: { label: 'IRR', step: '0.1' },
              leverageF2Min: { label: 'LEVERAGE F2 MIN', step: '0.1' },
              leverageF2Max: { label: 'LEVERAGE F2 MAX', step: '0.1' },
              ro40Min: { label: 'RO40 MIN', step: '0.01' },
              ro40Max: { label: 'RO40 MAX', step: '0.01' },
              cashSdebtMin: { label: 'Cash/SDebt MIN', step: '0.1' },
              cashSdebtMax: { label: 'Cash/SDebt MAX', step: '0.1' },
              currentRatioMin: { label: 'Current Ratio MIN', step: '0.1' },
              currentRatioMax: { label: 'Current Ratio MAX', step: '0.1' },
            }).map(([key, config]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">{config.label}</span>
                <input
                  type="number"
                  step={config.step}
                  value={values[key as keyof ThresholdValues] || ''}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    handleThresholdChange(item.industry, key as keyof ThresholdValues, value);
                  }}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-24 text-center"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }, [thresholdValues, handleThresholdChange]);

  return (
    <BaseTable<ThresholdIndustryData>
      data={data}
      loading={loading}
      error={error}
      columns={THRESHOLD_INDUSTRY_COLUMNS}
      filters={thresholdFilters}
      tableId="threshold-industry"
      renderCell={renderCell}
      renderHeader={renderHeader}
      renderMobileCard={renderMobileCard}
      enableVirtualScroll={true}
      virtualScrollRowHeight={60}
      virtualScrollOverscan={10}
      enableMobileExpand={true}
      searchFields={['industry']}
      searchPlaceholder="Sök efter bransch..."
      defaultSortKey="industry"
      defaultSortDirection="asc"
      stickyColumns={['antal', 'industry']}
      ariaLabel="Threshold Industry"
      minTableWidth="800px"
      getRowKey={(item, index) => `${item.industry}-${index}`}
    />
  );
}
