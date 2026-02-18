import React, { useMemo, useCallback, useState } from 'react';
import { IndustryThresholdData } from '../types/stock';
import BaseTable, { ColumnDefinition, HeaderRenderProps } from './BaseTable';
import ColumnTooltip from './ColumnTooltip';
import ColumnFilterMenu from './ColumnFilterMenu';
import { getColumnMetadata } from '../config/tableMetadata';
import { FilterConfig } from './AdvancedFilters';
import { ShareableTableState } from '../types/filters';
import { useTranslation } from 'react-i18next';
import { useThresholdValues, ThresholdValues } from '../contexts/ThresholdContext';
import { useAuth } from '../contexts/AuthContext';

interface IndustryThresholdTableProps {
  data: IndustryThresholdData[];
  loading: boolean;
  error: string | null;
  initialTableState?: ShareableTableState;
}

const THRESHOLD_INDUSTRY_COLUMNS: ColumnDefinition<IndustryThresholdData>[] = [
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
  { key: 'actions', label: 'Actions', defaultVisible: true, sortable: false, align: 'center' },
];

export default function IndustryThresholdTable({ data, loading, error, initialTableState }: IndustryThresholdTableProps) {
  const { t } = useTranslation();
  const { userRole } = useAuth();
  const { getFieldValue, setFieldValue } = useThresholdValues();
  const isReadOnly = userRole !== 'admin';
  const [editingRow, setEditingRow] = useState<IndustryThresholdData | null>(null);
  const [modalValues, setModalValues] = useState({
    irr: '',
    leverageF2Min: '',
    leverageF2Max: '',
    ro40Min: '',
    ro40Max: '',
    cashSdebtMin: '',
    cashSdebtMax: '',
    currentRatioMin: '',
    currentRatioMax: '',
  });

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

  const openEditModal = useCallback((item: IndustryThresholdData) => {
    setModalValues({
      irr: String(getFieldValue(item.industryKey, 'irr') || ''),
      leverageF2Min: String(getFieldValue(item.industryKey, 'leverageF2Min') || ''),
      leverageF2Max: String(getFieldValue(item.industryKey, 'leverageF2Max') || ''),
      ro40Min: String(getFieldValue(item.industryKey, 'ro40Min') || ''),
      ro40Max: String(getFieldValue(item.industryKey, 'ro40Max') || ''),
      cashSdebtMin: String(getFieldValue(item.industryKey, 'cashSdebtMin') || ''),
      cashSdebtMax: String(getFieldValue(item.industryKey, 'cashSdebtMax') || ''),
      currentRatioMin: String(getFieldValue(item.industryKey, 'currentRatioMin') || ''),
      currentRatioMax: String(getFieldValue(item.industryKey, 'currentRatioMax') || ''),
    });
    setEditingRow(item);
  }, [getFieldValue]);

  const closeEditModal = useCallback(() => {
    setEditingRow(null);
  }, []);

  const handleModalChange = useCallback((field: keyof ThresholdValues, value: string) => {
    setModalValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleModalSave = useCallback(() => {
    if (!editingRow) return;
    const parsed = {
      irr: parseFloat(modalValues.irr),
      leverageF2Min: parseFloat(modalValues.leverageF2Min),
      leverageF2Max: parseFloat(modalValues.leverageF2Max),
      ro40Min: parseFloat(modalValues.ro40Min),
      ro40Max: parseFloat(modalValues.ro40Max),
      cashSdebtMin: parseFloat(modalValues.cashSdebtMin),
      cashSdebtMax: parseFloat(modalValues.cashSdebtMax),
      currentRatioMin: parseFloat(modalValues.currentRatioMin),
      currentRatioMax: parseFloat(modalValues.currentRatioMax),
    };

    const values: ThresholdValues = {
      irr: Number.isFinite(parsed.irr) ? parsed.irr : 0,
      leverageF2Min: Number.isFinite(parsed.leverageF2Min) ? parsed.leverageF2Min : 0,
      leverageF2Max: Number.isFinite(parsed.leverageF2Max) ? parsed.leverageF2Max : 0,
      ro40Min: Number.isFinite(parsed.ro40Min) ? parsed.ro40Min : 0,
      ro40Max: Number.isFinite(parsed.ro40Max) ? parsed.ro40Max : 0,
      cashSdebtMin: Number.isFinite(parsed.cashSdebtMin) ? parsed.cashSdebtMin : 0,
      cashSdebtMax: Number.isFinite(parsed.cashSdebtMax) ? parsed.cashSdebtMax : 0,
      currentRatioMin: Number.isFinite(parsed.currentRatioMin) ? parsed.currentRatioMin : 0,
      currentRatioMax: Number.isFinite(parsed.currentRatioMax) ? parsed.currentRatioMax : 0,
    };

    (Object.keys(values) as Array<keyof ThresholdValues>).forEach((field) => {
      setFieldValue(editingRow.industryKey, field, values[field]);
    });
    closeEditModal();
  }, [closeEditModal, editingRow, modalValues, setFieldValue]);

  // Custom header renderer with ColumnTooltip
  const renderHeader = useCallback((props: HeaderRenderProps<IndustryThresholdData>) => {
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
    const metadata = getColumnMetadata('industry-threshold', column.key);
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
  const renderCell = useCallback((item: IndustryThresholdData, column: ColumnDefinition<IndustryThresholdData>, index: number, globalIndex: number) => {
    // Use getFieldValue for individual fields (supports draft)
    const irr = getFieldValue(item.industryKey, 'irr');
    const leverageF2Min = getFieldValue(item.industryKey, 'leverageF2Min');
    const leverageF2Max = getFieldValue(item.industryKey, 'leverageF2Max');
    const ro40Min = getFieldValue(item.industryKey, 'ro40Min');
    const ro40Max = getFieldValue(item.industryKey, 'ro40Max');
    const cashSdebtMin = getFieldValue(item.industryKey, 'cashSdebtMin');
    const cashSdebtMax = getFieldValue(item.industryKey, 'cashSdebtMax');
    const currentRatioMin = getFieldValue(item.industryKey, 'currentRatioMin');
    const currentRatioMax = getFieldValue(item.industryKey, 'currentRatioMax');
    const values = { irr, leverageF2Min, leverageF2Max, ro40Min, ro40Max, cashSdebtMin, cashSdebtMax, currentRatioMin, currentRatioMax };

    switch (column.key) {
      case 'antal':
        return globalIndex + 1;
      case 'industry':
        return <span className="font-medium">{item.industry}</span>;
      case 'irr':
        return <span className="text-sm text-black dark:text-white">{values.irr}</span>;
      case 'leverageF2Min':
        return <span className="text-sm text-black dark:text-white">{values.leverageF2Min}</span>;
      case 'leverageF2Max':
        return <span className="text-sm text-black dark:text-white">{values.leverageF2Max}</span>;
      case 'ro40Min':
        return <span className="text-sm text-black dark:text-white">{values.ro40Min}</span>;
      case 'ro40Max':
        return <span className="text-sm text-black dark:text-white">{values.ro40Max}</span>;
      case 'cashSdebtMin':
        return <span className="text-sm text-black dark:text-white">{values.cashSdebtMin}</span>;
      case 'cashSdebtMax':
        return <span className="text-sm text-black dark:text-white">{values.cashSdebtMax}</span>;
      case 'currentRatioMin':
        return <span className="text-sm text-black dark:text-white">{values.currentRatioMin}</span>;
      case 'currentRatioMax':
        return <span className="text-sm text-black dark:text-white">{values.currentRatioMax}</span>;
      case 'actions':
        if (isReadOnly) {
          return <span className="text-gray-400">-</span>;
        }
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openEditModal(item);
            }}
            className="px-3 py-1 text-sm font-medium text-blue-700 dark:text-blue-200 bg-blue-50 dark:bg-blue-900/20 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
          >
            Edit
          </button>
        );
      default:
        return null;
    }
  }, [getFieldValue, isReadOnly, openEditModal]);

  // Render mobile card
  const renderMobileCard = useCallback((item: IndustryThresholdData, index: number, globalIndex: number, isExpanded: boolean, toggleExpand: () => void) => {
    const rowKey = `${item.industryKey}-${globalIndex}`;
    const rowBgClass = globalIndex % 2 === 0 
      ? 'bg-white dark:bg-gray-800' 
      : 'bg-gray-50 dark:bg-gray-800/50';
    
    // Use getFieldValue for individual fields (supports draft)
    const values = {
      irr: getFieldValue(item.industryKey, 'irr'),
      leverageF2Min: getFieldValue(item.industryKey, 'leverageF2Min'),
      leverageF2Max: getFieldValue(item.industryKey, 'leverageF2Max'),
      ro40Min: getFieldValue(item.industryKey, 'ro40Min'),
      ro40Max: getFieldValue(item.industryKey, 'ro40Max'),
      cashSdebtMin: getFieldValue(item.industryKey, 'cashSdebtMin'),
      cashSdebtMax: getFieldValue(item.industryKey, 'cashSdebtMax'),
      currentRatioMin: getFieldValue(item.industryKey, 'currentRatioMin'),
      currentRatioMax: getFieldValue(item.industryKey, 'currentRatioMax'),
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
                <span className="text-sm text-black dark:text-white">{values[key as keyof ThresholdValues]}</span>
              </div>
            ))}
            {!isReadOnly && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditModal(item);
                  }}
                  className="w-full px-3 py-2 text-sm font-medium text-blue-700 dark:text-blue-200 bg-blue-50 dark:bg-blue-900/20 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                >
                  Edit Thresholds
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }, [getFieldValue, isReadOnly, openEditModal]);

  return (
    <>
      <BaseTable<IndustryThresholdData>
        data={data}
        loading={loading}
        error={error}
        columns={THRESHOLD_INDUSTRY_COLUMNS}
        filters={thresholdFilters}
        tableId="industry-threshold"
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
      headerCellPaddingClass="px-2 py-2"
      cellPaddingClass="px-2 py-2"
      ariaLabel="Industry Threshold"
        minTableWidth="100%"
        getRowKey={(item) => item.industryKey}
        initialFilterState={initialTableState?.filterState}
        initialColumnFilters={initialTableState?.columnFilters}
        initialSearchValue={initialTableState?.searchValue}
        initialSortConfig={initialTableState?.sortConfig}
      />

      {editingRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="industry-threshold-modal-title"
        >
          <div className="w-full max-w-2xl rounded-lg bg-white dark:bg-gray-800 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
              <div>
                <h2 id="industry-threshold-modal-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Edit Industry Thresholds
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">{editingRow.industry}</p>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([
                { field: 'irr', label: 'IRR', step: '0.1' },
                { field: 'leverageF2Min', label: 'LEVERAGE F2 MIN', step: '0.1' },
                { field: 'leverageF2Max', label: 'LEVERAGE F2 MAX', step: '0.1' },
                { field: 'ro40Min', label: 'RO40 MIN', step: '0.01' },
                { field: 'ro40Max', label: 'RO40 MAX', step: '0.01' },
                { field: 'cashSdebtMin', label: 'Cash/SDebt MIN', step: '0.1' },
                { field: 'cashSdebtMax', label: 'Cash/SDebt MAX', step: '0.1' },
                { field: 'currentRatioMin', label: 'Current Ratio MIN', step: '0.1' },
                { field: 'currentRatioMax', label: 'Current Ratio MAX', step: '0.1' },
              ] as const).map((config) => (
                <div key={config.field} className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    {config.label}
                  </label>
                  <input
                    type="number"
                    step={config.step}
                    value={modalValues[config.field]}
                    onChange={(e) => handleModalChange(config.field, e.target.value)}
                    className="w-full rounded-md border px-3 py-2 text-sm bg-white dark:bg-gray-700 text-black dark:text-white focus:outline-none focus:ring-2 focus:border-transparent border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
              <button
                type="button"
                onClick={closeEditModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleModalSave}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
