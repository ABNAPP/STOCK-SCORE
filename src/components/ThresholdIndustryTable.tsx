import React, { useEffect, useMemo, useCallback } from 'react';
import { ThresholdIndustryData } from '../types/stock';
import BaseTable, { ColumnDefinition, HeaderRenderProps } from './BaseTable';
import ColumnTooltip from './ColumnTooltip';
import ColumnFilterMenu from './ColumnFilterMenu';
import { getColumnMetadata } from '../config/tableMetadata';
import { FilterConfig } from './AdvancedFilters';
import { ShareableTableState } from '../types/filters';
import { useTranslation } from 'react-i18next';
import { useThresholdValues, ThresholdValues } from '../contexts/ThresholdContext';
import { useAuth } from '../contexts/AuthContext';

interface ThresholdIndustryTableProps {
  data: ThresholdIndustryData[];
  loading: boolean;
  error: string | null;
  initialTableState?: ShareableTableState;
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

export default function ThresholdIndustryTable({ data, loading, error, initialTableState }: ThresholdIndustryTableProps) {
  const { t } = useTranslation();
  const { userRole } = useAuth();
  const { thresholdValues, getThresholdValue, getFieldValue, setFieldValue, commitField, initializeFromData } = useThresholdValues();
  const isReadOnly = userRole !== 'admin';

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
    initializeFromData(data);
  }, [data, initializeFromData]);

  const handleThresholdChange = useCallback((industry: string, field: keyof ThresholdValues, value: number) => {
    setFieldValue(industry, field, value);
  }, [setFieldValue]);

  const inputClass = 'px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-24 text-center';

  const renderThresholdField = useCallback(
    (industry: string, field: keyof ThresholdValues, value: number | string, step: string) =>
      isReadOnly ? (
        <span className="text-sm text-black dark:text-white">{value}</span>
      ) : (
        <input
          type="number"
          step={step}
          value={value || ''}
          onChange={(e) => {
            const v = parseFloat(e.target.value) || 0;
            handleThresholdChange(industry, field, v);
          }}
          onBlur={() => commitField(industry, field)}
          className={inputClass}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    [isReadOnly, handleThresholdChange, commitField]
  );

  // Custom header renderer with ColumnTooltip
  const renderHeader = useCallback((props: HeaderRenderProps<ThresholdIndustryData>) => {
    const { 
      column, 
      sortConfig, 
      handleSort, 
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
    } = props;
    const metadata = getColumnMetadata('threshold-industry', column.key);
    const isSticky = column.sticky;
    const sortIcon = getSortIcon(column.key);
    const stickyClass = isSticky ? `sm:sticky sm:top-0 ${getStickyPosition(column.key)} z-50` : '';
    const isFilterMenuOpen = openFilterMenuColumn === column.key;
    const hasActiveFilter = hasActiveColumnFilter(column.key);
    const headerRef = headerRefs.current[column.key] || null;

    const handleFilterIconClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isFilterMenuOpen) {
        setOpenFilterMenuColumn(null);
      } else {
        setOpenFilterMenuColumn(column.key);
      }
    };

    const handleSortClick = (e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation();
      }
      if (!isFilterMenuOpen) {
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
    
    if (!column.sortable) {
      const headerContent = (
        <th
          ref={(el) => {
            headerRefs.current[column.key] = el;
          }}
          className={`px-6 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider ${stickyClass} bg-gray-50 dark:bg-gray-900`}
          scope="col"
          role="columnheader"
        >
          <div className="flex items-center justify-between relative w-full">
            <div className="flex items-center flex-1">
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
            </div>
          </div>
        </th>
      );
      return <React.Fragment key={column.key}>{headerContent}</React.Fragment>;
    }

    const headerContent = (
      <th
        ref={(el) => {
          headerRefs.current[column.key] = el;
        }}
        onClick={handleSortClick}
        className={`px-6 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-200 transition-all duration-200 ${stickyClass} bg-gray-50 dark:bg-gray-900`}
        scope="col"
        role="columnheader"
      >
        <div className="flex items-center justify-between relative w-full">
          <div className="flex items-center flex-1" onClick={handleSortClick}>
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
          </div>
        </div>
      </th>
    );
    return <React.Fragment key={column.key}>{headerContent}</React.Fragment>;
  }, []);

  // Render cell content with editable inputs
  const renderCell = useCallback((item: ThresholdIndustryData, column: ColumnDefinition<ThresholdIndustryData>, index: number, globalIndex: number) => {
    // Use getFieldValue for individual fields (supports draft)
    const irr = getFieldValue(item.industry, 'irr');
    const leverageF2Min = getFieldValue(item.industry, 'leverageF2Min');
    const leverageF2Max = getFieldValue(item.industry, 'leverageF2Max');
    const ro40Min = getFieldValue(item.industry, 'ro40Min');
    const ro40Max = getFieldValue(item.industry, 'ro40Max');
    const cashSdebtMin = getFieldValue(item.industry, 'cashSdebtMin');
    const cashSdebtMax = getFieldValue(item.industry, 'cashSdebtMax');
    const currentRatioMin = getFieldValue(item.industry, 'currentRatioMin');
    const currentRatioMax = getFieldValue(item.industry, 'currentRatioMax');
    const values = { irr, leverageF2Min, leverageF2Max, ro40Min, ro40Max, cashSdebtMin, cashSdebtMax, currentRatioMin, currentRatioMax };

    switch (column.key) {
      case 'antal':
        return globalIndex + 1;
      case 'industry':
        return <span className="font-medium">{item.industry}</span>;
      case 'irr':
        return renderThresholdField(item.industry, 'irr', values.irr, '0.1');
      case 'leverageF2Min':
        return renderThresholdField(item.industry, 'leverageF2Min', values.leverageF2Min, '0.1');
      case 'leverageF2Max':
        return renderThresholdField(item.industry, 'leverageF2Max', values.leverageF2Max, '0.1');
      case 'ro40Min':
        return renderThresholdField(item.industry, 'ro40Min', values.ro40Min, '0.01');
      case 'ro40Max':
        return renderThresholdField(item.industry, 'ro40Max', values.ro40Max, '0.01');
      case 'cashSdebtMin':
        return renderThresholdField(item.industry, 'cashSdebtMin', values.cashSdebtMin, '0.1');
      case 'cashSdebtMax':
        return renderThresholdField(item.industry, 'cashSdebtMax', values.cashSdebtMax, '0.1');
      case 'currentRatioMin':
        return renderThresholdField(item.industry, 'currentRatioMin', values.currentRatioMin, '0.1');
      case 'currentRatioMax':
        return renderThresholdField(item.industry, 'currentRatioMax', values.currentRatioMax, '0.1');
      default:
        return null;
    }
  }, [getFieldValue, renderThresholdField]);

  // Render mobile card
  const renderMobileCard = useCallback((item: ThresholdIndustryData, index: number, globalIndex: number, isExpanded: boolean, toggleExpand: () => void) => {
    const rowKey = `${item.industry}-${globalIndex}`;
    const rowBgClass = globalIndex % 2 === 0 
      ? 'bg-white dark:bg-gray-800' 
      : 'bg-gray-50 dark:bg-gray-800/50';
    
    // Use getFieldValue for individual fields (supports draft)
    const values = {
      irr: getFieldValue(item.industry, 'irr'),
      leverageF2Min: getFieldValue(item.industry, 'leverageF2Min'),
      leverageF2Max: getFieldValue(item.industry, 'leverageF2Max'),
      ro40Min: getFieldValue(item.industry, 'ro40Min'),
      ro40Max: getFieldValue(item.industry, 'ro40Max'),
      cashSdebtMin: getFieldValue(item.industry, 'cashSdebtMin'),
      cashSdebtMax: getFieldValue(item.industry, 'cashSdebtMax'),
      currentRatioMin: getFieldValue(item.industry, 'currentRatioMin'),
      currentRatioMax: getFieldValue(item.industry, 'currentRatioMax'),
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
              <span className="text-sm font-medium text-black dark:text-white">{globalIndex + 1}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">INDUSTRY</span>
              <span className="text-sm font-medium text-black dark:text-white text-right">{item.industry}</span>
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
            {Object.entries({
              irr: { label: 'IRR', step: '0.1' as const },
              leverageF2Min: { label: 'LEVERAGE F2 MIN', step: '0.1' as const },
              leverageF2Max: { label: 'LEVERAGE F2 MAX', step: '0.1' as const },
              ro40Min: { label: 'RO40 MIN', step: '0.01' as const },
              ro40Max: { label: 'RO40 MAX', step: '0.01' as const },
              cashSdebtMin: { label: 'Cash/SDebt MIN', step: '0.1' as const },
              cashSdebtMax: { label: 'Cash/SDebt MAX', step: '0.1' as const },
              currentRatioMin: { label: 'Current Ratio MIN', step: '0.1' as const },
              currentRatioMax: { label: 'Current Ratio MAX', step: '0.1' as const },
            }).map(([key, config]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">{config.label}</span>
                {renderThresholdField(item.industry, key as keyof ThresholdValues, values[key as keyof ThresholdValues], config.step)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }, [getFieldValue, renderThresholdField]);

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
      getRowKey={(item) => item.industry}
      initialFilterState={initialTableState?.filterState}
      initialColumnFilters={initialTableState?.columnFilters}
      initialSearchValue={initialTableState?.searchValue}
      initialSortConfig={initialTableState?.sortConfig}
    />
  );
}
