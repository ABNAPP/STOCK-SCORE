import React, { useMemo, useCallback } from 'react';
import { ScoreBoardData, ThresholdIndustryData } from '../types/stock';
import BaseTable, { ColumnDefinition, HeaderRenderProps } from './BaseTable';
import ColumnTooltip from './ColumnTooltip';
import ColumnFilterMenu from './ColumnFilterMenu';
import { getColumnMetadata } from '../config/tableMetadata';
import { FilterConfig } from './AdvancedFilters';
import { useTranslation } from 'react-i18next';
import { useEntryExitValues } from '../contexts/EntryExitContext';
import { useBenjaminGrahamData } from '../hooks/useBenjaminGrahamData';
import {
  PRICE_TOLERANCE_GREEN,
  RR1_GREEN_THRESHOLD_PERCENT,
  MUNGER_QUALITY_SCORE_RED_THRESHOLD,
  MUNGER_QUALITY_SCORE_GREEN_THRESHOLD,
  TB_S_PRICE_GREEN_THRESHOLD,
} from '../config/constants';

interface ScoreBoardTableProps {
  data: ScoreBoardData[];
  loading: boolean;
  error: string | null;
  thresholdData?: ThresholdIndustryData[];
}

// Color constants - WCAG AA compliant (4.5:1 contrast ratio)
const COLORS = {
  red: 'text-red-700 dark:text-red-400',
  green: 'text-green-700 dark:text-green-200',
  blue: 'text-blue-700 dark:text-blue-400',
  yellow: 'text-yellow-700 dark:text-yellow-300',
} as const;

// Configuration interface for threshold-based color logic
export interface ThresholdColorConfig {
  industry?: string;
  thresholdData?: ThresholdIndustryData[];
  // For min/max range
  minKey?: keyof ThresholdIndustryData;
  maxKey?: keyof ThresholdIndustryData;
  // For single threshold
  thresholdKey?: keyof ThresholdIndustryData;
  // Value transformation (e.g., percentage to decimal)
  transform?: (value: number) => number;
  // Special case (e.g., isDivZero)
  specialCase?: { condition: boolean; color: string };
  // Comparison mode: 'normal' or 'inverted' (for leverageF2)
  comparisonMode?: 'normal' | 'inverted';
}

/**
 * Generic function to get color based on threshold comparison
 * Handles industry-based thresholds with configurable comparison logic
 */
export function getColorByThreshold(
  value: number | null,
  config: ThresholdColorConfig
): string | null {
  // Check special case first (e.g., isDivZero) - before null check
  if (config.specialCase?.condition) {
    return config.specialCase.color;
  }

  // Validate value
  if (value === null || !isFinite(value)) {
    return null;
  }

  // Validate industry if industry-based
  if (config.industry !== undefined && (!config.industry || config.industry.trim() === '')) {
    return null;
  }

  // Find threshold from thresholdData
  if (config.thresholdData && config.industry) {
    const threshold = config.thresholdData.find(
      t => t.industry.toLowerCase() === config.industry!.toLowerCase()
    );
    if (!threshold) {
      return null;
    }

    // Apply transformation if provided
    let transformedValue = value;
    if (config.transform) {
      transformedValue = config.transform(value);
    }

    // Handle single threshold (e.g., IRR)
    if (config.thresholdKey) {
      const thresholdValue = threshold[config.thresholdKey] as number;
      if (transformedValue >= thresholdValue) {
        return COLORS.green;
      }
      return COLORS.red;
    }

    // Handle min/max range
    if (config.minKey && config.maxKey) {
      const min = threshold[config.minKey] as number;
      const max = threshold[config.maxKey] as number;

      if (config.comparisonMode === 'inverted') {
        // Inverted logic for leverageF2: <= min = green, <= max = blue, > max = red
        if (transformedValue <= min) {
          return COLORS.green;
        }
        if (transformedValue <= max) {
          return COLORS.blue;
        }
        return COLORS.red;
      } else {
        // Normal logic
        // For currentRatio: < min = red, >= min && < max = green, >= max = blue
        // For cashSdebt/ro40: <= min = red, >= max = green, between = blue
        if (config.minKey === 'currentRatioMin') {
          // CurrentRatio uses < min (not <=)
          if (transformedValue < min) {
            return COLORS.red;
          }
          if (transformedValue >= min && transformedValue < max) {
            return COLORS.green;
          }
          if (transformedValue >= max) {
            return COLORS.blue;
          }
        } else {
          // CashSdebt and Ro40 use <= min
          if (transformedValue <= min) {
            return COLORS.red;
          }
          if (transformedValue >= max) {
            return COLORS.green;
          }
          return COLORS.blue;
        }
      }
    }
  }

  return null;
}

// Color helper functions (refactored to use getColorByThreshold)
export function getCurrentRatioColor(
  currentRatio: number | null,
  industry: string,
  thresholdData: ThresholdIndustryData[]
): string | null {
  return getColorByThreshold(currentRatio, {
    industry,
    thresholdData,
    minKey: 'currentRatioMin',
    maxKey: 'currentRatioMax',
    comparisonMode: 'normal',
  });
}

export function getCashSdebtColor(
  cashSdebt: number | null,
  isDivZero: boolean,
  industry: string,
  thresholdData: ThresholdIndustryData[]
): string | null {
  return getColorByThreshold(cashSdebt, {
    industry,
    thresholdData,
    minKey: 'cashSdebtMin',
    maxKey: 'cashSdebtMax',
    comparisonMode: 'normal',
    specialCase: {
      condition: isDivZero,
      color: COLORS.green,
    },
  });
}

export function getRo40Color(
  ro40Value: number | null,
  industry: string,
  thresholdData: ThresholdIndustryData[]
): string | null {
  return getColorByThreshold(ro40Value, {
    industry,
    thresholdData,
    minKey: 'ro40Min',
    maxKey: 'ro40Max',
    comparisonMode: 'normal',
    transform: (v) => v / 100,
  });
}

export function getTBSPPriceColor(tbSPrice: number | null): string | null {
  if (tbSPrice === null || !isFinite(tbSPrice)) {
    return null;
  }
  if (tbSPrice < TB_S_PRICE_GREEN_THRESHOLD) {
    return COLORS.red;
  }
  if (tbSPrice >= TB_S_PRICE_GREEN_THRESHOLD) {
    return COLORS.green;
  }
  return null;
}

export function getSMAColor(
  price: number | null | undefined,
  smaValue: number | null
): string | null {
  if (price === null || price === undefined || !isFinite(price) || 
      smaValue === null || !isFinite(smaValue)) {
    return null;
  }
  if (price > smaValue) {
    return COLORS.green;
  }
  if (price < smaValue) {
    return COLORS.red;
  }
  return COLORS.yellow;
}

export function getIRRColor(
  irrValue: number | null,
  industry: string,
  thresholdData: ThresholdIndustryData[]
): string | null {
  return getColorByThreshold(irrValue, {
    industry,
    thresholdData,
    thresholdKey: 'irr',
    comparisonMode: 'normal',
  });
}

export function getLeverageF2Color(
  leverageF2Value: number | null,
  industry: string,
  thresholdData: ThresholdIndustryData[]
): string | null {
  return getColorByThreshold(leverageF2Value, {
    industry,
    thresholdData,
    minKey: 'leverageF2Min',
    maxKey: 'leverageF2Max',
    comparisonMode: 'inverted',
  });
}

const SCORE_BOARD_COLUMNS: ColumnDefinition[] = [
  { key: 'antal', label: 'Antal', required: true, sticky: true, sortable: false },
  { key: 'companyName', label: 'Company Name', required: true, sticky: true, sortable: true },
  { key: 'ticker', label: 'Ticker', required: true, sticky: true, sortable: true },
  { key: 'irr', label: 'IRR', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'mungerQualityScore', label: 'Munger Quality Score', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'valueCreation', label: 'Value Creation', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'tbSPrice', label: '(TB/S)/Price', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'ro40F1', label: 'Ro40 F1', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'ro40F2', label: 'Ro40 F2', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'currentRatio', label: 'Current Ratio', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'cashSdebt', label: 'Cash/SDebt', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'leverageF2', label: 'Leverage F2', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'pe1Industry', label: 'P/E1 Industry', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'pe2Industry', label: 'P/E2 Industry', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'sma100', label: 'SMA(100)', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'sma200', label: 'SMA(200)', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'smaCross', label: 'SMA Cross', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'theoEntry', label: 'TheoEntry', defaultVisible: true, sortable: false, align: 'center' },
];

export default function ScoreBoardTable({ data, loading, error, thresholdData = [] }: ScoreBoardTableProps) {
  const { t } = useTranslation();
  const { getEntryExitValue } = useEntryExitValues();
  const { data: benjaminGrahamData } = useBenjaminGrahamData();
  
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

  // Define filter configurations
  const scoreBoardFilters: FilterConfig[] = useMemo(() => [
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
      key: 'industry',
      label: 'Industri',
      type: 'select',
      options: uniqueIndustries,
    },
    {
      key: 'irr',
      label: 'IRR (%)',
      type: 'numberRange',
      step: 0.1,
    },
    {
      key: 'mungerQualityScore',
      label: 'Munger Quality Score',
      type: 'numberRange',
      min: 0,
      max: 100,
      step: 1,
    },
    {
      key: 'valueCreation',
      label: 'Value Creation (%)',
      type: 'numberRange',
      step: 0.1,
    },
    {
      key: 'ro40F1',
      label: 'Ro40 F1 (%)',
      type: 'numberRange',
      step: 0.1,
    },
    {
      key: 'ro40F2',
      label: 'Ro40 F2 (%)',
      type: 'numberRange',
      step: 0.1,
    },
    {
      key: 'currentRatio',
      label: 'Current Ratio',
      type: 'numberRange',
      step: 0.01,
    },
  ], [uniqueIndustries]);

  // Calculate RR1 helper
  const calculateRR1 = useCallback((entry1: number, exit1: number): number | null => {
    if (!entry1 || !exit1 || entry1 === 0) return null;
    const rr1 = ((exit1 - entry1) / entry1) * 100;
    return isNaN(rr1) || !isFinite(rr1) ? null : rr1;
  }, []);

  // Calculate RR2 helper
  const calculateRR2 = useCallback((entry2: number, exit2: number): number | null => {
    if (!entry2 || !exit2 || entry2 === 0) return null;
    const rr2 = ((exit2 - entry2) / entry2) * 100;
    return isNaN(rr2) || !isFinite(rr2) ? null : rr2;
  }, []);

  // Get Price from BenjaminGrahamData
  const getPriceFromBenjaminGraham = useCallback((ticker: string, companyName: string): number | null => {
    const match = benjaminGrahamData.find(
      item => item.ticker?.toLowerCase() === ticker.toLowerCase() ||
              item.companyName?.toLowerCase() === companyName.toLowerCase()
    );
    return match?.price ?? null;
  }, [benjaminGrahamData]);

  // Check if RR1 is green
  const isRR1Green = useCallback((ticker: string, companyName: string): boolean => {
    const entryExitValues = getEntryExitValue(ticker, companyName);
    if (!entryExitValues) return false;
    const entry1 = entryExitValues.entry1 || 0;
    const exit1 = entryExitValues.exit1 || 0;
    const price = getPriceFromBenjaminGraham(ticker, companyName);
    const rr1 = calculateRR1(entry1, exit1);
    return rr1 !== null && rr1 >= RR1_GREEN_THRESHOLD_PERCENT && price !== null && price > 0 && entry1 > 0 && price <= entry1 * PRICE_TOLERANCE_GREEN;
  }, [getEntryExitValue, getPriceFromBenjaminGraham, calculateRR1]);

  // Check if Entry1 is green
  const isEntry1Green = useCallback((ticker: string, companyName: string): boolean => {
    const entryExitValues = getEntryExitValue(ticker, companyName);
    if (!entryExitValues) return false;
    const entry1 = entryExitValues.entry1 || 0;
    const price = getPriceFromBenjaminGraham(ticker, companyName);
    return entry1 > 0 && price !== null && price > 0 && price <= entry1 * PRICE_TOLERANCE_GREEN;
  }, [getEntryExitValue, getPriceFromBenjaminGraham]);

  // Check if RR2 is green for TheoEntry (RR2 > 60% and Price ≤ Entry2 * 1.05)
  const isRR2GreenForTheoEntry = useCallback((ticker: string, companyName: string): boolean => {
    const entryExitValues = getEntryExitValue(ticker, companyName);
    if (!entryExitValues) return false;
    const entry2 = entryExitValues.entry2 || 0;
    const exit2 = entryExitValues.exit2 || 0;
    const price = getPriceFromBenjaminGraham(ticker, companyName);
    const rr2 = calculateRR2(entry2, exit2);
    // RR2 is green for TheoEntry when: RR2 > 60%, Price > 0, Entry2 > 0, Price ≤ Entry2 * 1.05
    return rr2 !== null && rr2 > RR1_GREEN_THRESHOLD_PERCENT && price !== null && price > 0 && entry2 > 0 && price <= entry2 * PRICE_TOLERANCE_GREEN;
  }, [getEntryExitValue, getPriceFromBenjaminGraham, calculateRR2]);

  // Check if Entry2 is green
  const isEntry2Green = useCallback((ticker: string, companyName: string): boolean => {
    const entryExitValues = getEntryExitValue(ticker, companyName);
    if (!entryExitValues) return false;
    const entry2 = entryExitValues.entry2 || 0;
    const price = getPriceFromBenjaminGraham(ticker, companyName);
    return entry2 > 0 && price !== null && price > 0 && price <= entry2 * PRICE_TOLERANCE_GREEN;
  }, [getEntryExitValue, getPriceFromBenjaminGraham]);

  // Check if TheoEntry should show "B" (either RR1+Entry1 OR RR2+Entry2 are green)
  const isTheoEntryGreen = useCallback((ticker: string, companyName: string): boolean => {
    // RR1 path: RR1 is green AND Entry1 is green
    const rr1Path = isRR1Green(ticker, companyName) && isEntry1Green(ticker, companyName);
    
    // RR2 path: RR2 > 60% AND Entry2 is green
    const rr2Path = isRR2GreenForTheoEntry(ticker, companyName) && isEntry2Green(ticker, companyName);
    
    return rr1Path || rr2Path;
  }, [isRR1Green, isEntry1Green, isRR2GreenForTheoEntry, isEntry2Green]);

  // Custom header renderer with ColumnTooltip
  const renderHeader = useCallback((props: HeaderRenderProps) => {
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
    const metadata = getColumnMetadata('score-board', column.key);
    const isSticky = column.sticky;
    const isSorted = sortConfig.key === column.key;
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

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSortClick();
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
                  <div>{column.label}</div>
                </ColumnTooltip>
              ) : (
                column.label
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
      return headerContent;
    }

    return (
      <th
        ref={(el) => {
          headerRefs.current[column.key] = el;
        }}
        onClick={handleSortClick}
        onKeyDown={handleKeyDown}
        className={`px-6 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-200 transition-all duration-200 ${stickyClass} bg-gray-50 dark:bg-gray-900`}
        scope="col"
        role="columnheader"
        aria-label={`${t('aria.sortColumn')}: ${column.label}`}
        aria-sort={isSorted ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
        tabIndex={0}
      >
        <div className="flex items-center justify-between relative w-full">
          <div className="flex items-center flex-1" onClick={handleSortClick}>
            {metadata ? (
              <ColumnTooltip metadata={metadata}>
                <div className="flex items-center space-x-1">
                  <span>{column.label === 'VALUE CREATION' ? 'VALUE CREATION' : column.label}</span>
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
  }, [t]);

  // Render cell content
  const renderCell = useCallback((item: ScoreBoardData, column: ColumnDefinition, index: number, globalIndex: number) => {
    switch (column.key) {
      case 'antal':
        return globalIndex + 1;
      case 'companyName':
        return <span className="font-medium">{item.companyName}</span>;
      case 'ticker':
        return <span className="text-gray-600 dark:text-gray-300">{item.ticker}</span>;
      case 'irr':
        return (
          <span className={getIRRColor(item.irr, item.industry, thresholdData) || 'text-black dark:text-white'}>
            {item.irr !== null ? `${item.irr.toFixed(2)}%` : 'N/A'}
          </span>
        );
      case 'mungerQualityScore':
        return (
          <span className={
            item.mungerQualityScore === null
              ? 'text-black dark:text-white'
              : item.mungerQualityScore < MUNGER_QUALITY_SCORE_RED_THRESHOLD
              ? 'text-red-700 dark:text-red-400'
              : item.mungerQualityScore >= MUNGER_QUALITY_SCORE_RED_THRESHOLD && item.mungerQualityScore <= MUNGER_QUALITY_SCORE_GREEN_THRESHOLD
              ? 'text-blue-700 dark:text-blue-400'
              : 'text-green-700 dark:text-green-200'
          }>
            {item.mungerQualityScore !== null ? item.mungerQualityScore.toLocaleString() : 'N/A'}
          </span>
        );
      case 'valueCreation':
        return (
          <span className={
            item.valueCreation === null
              ? 'text-black dark:text-white'
              : item.valueCreation < 0
              ? 'text-red-700 dark:text-red-400'
              : 'text-green-700 dark:text-green-200'
          }>
            {item.valueCreation !== null ? `${item.valueCreation.toFixed(2)}%` : 'N/A'}
          </span>
        );
      case 'tbSPrice':
        return (
          <span className={getTBSPPriceColor(item.tbSPrice) || 'text-black dark:text-white'}>
            {item.tbSPrice !== null ? item.tbSPrice.toFixed(2) : 'N/A'}
          </span>
        );
      case 'ro40F1':
        return (
          <span className={getRo40Color(item.ro40F1, item.industry, thresholdData) || 'text-black dark:text-white'}>
            {item.ro40F1 !== null ? `${item.ro40F1.toFixed(2)}%` : 'N/A'}
          </span>
        );
      case 'ro40F2':
        return (
          <span className={getRo40Color(item.ro40F2, item.industry, thresholdData) || 'text-black dark:text-white'}>
            {item.ro40F2 !== null ? `${item.ro40F2.toFixed(2)}%` : 'N/A'}
          </span>
        );
      case 'currentRatio':
        return (
          <span className={getCurrentRatioColor(item.currentRatio, item.industry, thresholdData) || 'text-black dark:text-white'}>
            {item.currentRatio !== null ? item.currentRatio.toFixed(2) : 'N/A'}
          </span>
        );
      case 'cashSdebt':
        return (
          <span className={getCashSdebtColor(item.cashSdebt, item.isCashSdebtDivZero, item.industry, thresholdData) || 'text-black dark:text-white'}>
            {item.cashSdebt !== null ? item.cashSdebt.toFixed(2) : 'N/A'}
          </span>
        );
      case 'leverageF2':
        return (
          <span className={getLeverageF2Color(item.leverageF2, item.industry, thresholdData) || 'text-black dark:text-white'}>
            {item.leverageF2 !== null ? item.leverageF2.toLocaleString() : 'N/A'}
          </span>
        );
      case 'pe1Industry':
        return (
          <span className={
            item.pe1Industry === null
              ? 'text-black dark:text-white'
              : item.pe1Industry > 0
              ? 'text-red-700 dark:text-red-400'
              : 'text-green-700 dark:text-green-200'
          }>
            {item.pe1Industry !== null ? `${item.pe1Industry.toFixed(1)}%` : 'N/A'}
          </span>
        );
      case 'pe2Industry':
        return (
          <span className={
            item.pe2Industry === null
              ? 'text-black dark:text-white'
              : item.pe2Industry > 0
              ? 'text-red-700 dark:text-red-400'
              : 'text-green-700 dark:text-green-200'
          }>
            {item.pe2Industry !== null ? `${item.pe2Industry.toFixed(1)}%` : 'N/A'}
          </span>
        );
      case 'sma100':
        return (
          <span className={getSMAColor(item.price, item.sma100) || 'text-black dark:text-white'}>
            {item.sma100 !== null ? item.sma100.toFixed(2) : 'N/A'}
          </span>
        );
      case 'sma200':
        return (
          <span className={getSMAColor(item.price, item.sma200) || 'text-black dark:text-white'}>
            {item.sma200 !== null ? item.sma200.toFixed(2) : 'N/A'}
          </span>
        );
      case 'smaCross':
        return (
          <span className={
            item.smaCross && item.smaCross.toUpperCase().includes('GOLDEN')
              ? 'text-red-700 dark:text-red-400'
              : item.smaCross && item.smaCross.toUpperCase().includes('DEATH')
              ? 'text-green-700 dark:text-green-200'
              : 'text-black dark:text-white'
          }>
            {item.smaCross || 'N/A'}
          </span>
        );
      case 'theoEntry':
        return (
          <span className={
            isTheoEntryGreen(item.ticker, item.companyName)
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-200'
              : ''
          }>
            {isTheoEntryGreen(item.ticker, item.companyName) ? 'B' : ''}
          </span>
        );
      default:
        return null;
    }
  }, [thresholdData, isTheoEntryGreen]);

  // Render mobile card with expandable view
  const renderMobileCard = useCallback((item: ScoreBoardData, index: number, globalIndex: number, isExpanded: boolean, toggleExpand: () => void) => {
    const rowBgClass = globalIndex % 2 === 0 
      ? 'bg-white dark:bg-gray-800' 
      : 'bg-gray-50 dark:bg-gray-800/50';

    return (
      <div className={`${rowBgClass} rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm transition-all duration-300 ease-in-out`}>
        <div className="p-4 flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Antal</span>
              <span className="text-sm font-medium text-black dark:text-white">{globalIndex + 1}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Company Name</span>
              <span className="text-sm font-medium text-black dark:text-white text-right">{item.companyName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Ticker</span>
              <span className="text-sm text-gray-600 dark:text-gray-300">{item.ticker}</span>
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
        {isExpanded && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-3 animate-fade-in">
            {['irr', 'mungerQualityScore', 'valueCreation', 'tbSPrice', 'ro40F1', 'ro40F2', 'currentRatio', 'cashSdebt', 'leverageF2', 'pe1Industry', 'pe2Industry', 'sma100', 'sma200', 'smaCross', 'theoEntry'].map((key) => {
              const column = SCORE_BOARD_COLUMNS.find(c => c.key === key);
              if (!column) return null;
              return (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{column.label}</span>
                  <span className="text-sm text-black dark:text-white text-right">
                    {renderCell(item, column, index, globalIndex)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }, [renderCell]);

  return (
    <BaseTable<ScoreBoardData>
      data={data}
      loading={loading}
      error={error}
      columns={SCORE_BOARD_COLUMNS}
      filters={scoreBoardFilters}
      tableId="score-board"
      renderCell={renderCell}
      renderHeader={renderHeader}
      renderMobileCard={renderMobileCard}
      enableVirtualScroll={true}
      virtualScrollRowHeight={60}
      virtualScrollOverscan={10}
      enableMobileExpand={true}
      searchFields={['companyName', 'ticker', 'industry']}
      searchPlaceholder="Sök efter företag, ticker eller bransch..."
      defaultSortKey="companyName"
      defaultSortDirection="asc"
      stickyColumns={['antal', 'companyName', 'ticker']}
      ariaLabel={t('navigation.scoreBoard')}
      minTableWidth="800px"
      getRowKey={(item, index) => `${item.ticker}-${item.companyName}-${index}`}
      enableExport={true}
      enablePrint={true}
      enableShareableLink={true}
      viewId="score-board"
    />
  );
}
