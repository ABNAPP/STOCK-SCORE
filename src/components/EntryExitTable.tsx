import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { BenjaminGrahamData } from '../types/stock';
import BaseTable, { ColumnDefinition, HeaderRenderProps } from './BaseTable';
import ColumnTooltip from './ColumnTooltip';
import ColumnFilterMenu from './ColumnFilterMenu';
import { getColumnMetadata } from '../config/tableMetadata';
import { FilterConfig } from './AdvancedFilters';
import { ShareableTableState } from '../types/filters';
import { useTranslation } from 'react-i18next';
import { useEntryExitValues } from '../contexts/EntryExitContext';
import { useUserRole } from '../hooks/useUserRole';
import { DATE_NEAR_OLD_THRESHOLD_DAYS } from '../config/constants';
import {
  PRICE_TOLERANCE_GREEN,
  PRICE_TOLERANCE_BLUE,
  RR1_GREEN_THRESHOLD_PERCENT,
  RR2_GREEN_THRESHOLD_PERCENT,
} from '../config/constants';
import { isNumber, isString } from '../utils/typeGuards';
import { validateEntryExitValue } from '../utils/inputValidator';

interface EntryExitTableProps {
  data: BenjaminGrahamData[];
  loading: boolean;
  error: string | null;
  initialTableState?: ShareableTableState;
}

const CURRENCIES = ['USD', 'EUR', 'SEK', 'DKK', 'NOK', 'GBP', 'AUD', 'CAD', 'NZD'];

const ENTRY_EXIT_COLUMNS: ColumnDefinition<BenjaminGrahamData>[] = [
  { key: 'antal', label: 'Row', required: true, sticky: true, sortable: false },
  { key: 'companyName', label: 'Company Name', required: true, sticky: true, sortable: true },
  { key: 'ticker', label: 'Ticker', required: true, sticky: false, sortable: true },
  { key: 'currency', label: 'Currency', required: true, sticky: false, sortable: true, align: 'center' },
  { key: 'price', label: 'Price', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'benjaminGraham', label: 'Benjamin Graham', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'entry1', label: 'ENTRY1', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'entry2', label: 'ENTRY2', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'exit1', label: 'EXIT1', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'exit2', label: 'EXIT2', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'ivFcf', label: 'IV (FCF)', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'irr1', label: 'RR1', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'rr2', label: 'RR2', defaultVisible: true, sortable: false, align: 'center' },
  { key: 'dateOfUpdate', label: 'Date of Update', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'actions', label: 'Actions', defaultVisible: true, sortable: false, align: 'center' },
];

const ENTRY_EXIT_FILTERS: FilterConfig[] = [
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
    key: 'currency',
    label: 'Valuta',
    type: 'select',
    options: CURRENCIES.map(c => ({ value: c, label: c })),
  },
  {
    key: 'entry1',
    label: 'Entry1',
    type: 'numberRange',
    min: 0,
    step: 0.01,
  },
  {
    key: 'entry2',
    label: 'Entry2',
    type: 'numberRange',
    min: 0,
    step: 0.01,
  },
  {
    key: 'exit1',
    label: 'Exit1',
    type: 'numberRange',
    min: 0,
    step: 0.01,
  },
  {
    key: 'exit2',
    label: 'Exit2',
    type: 'numberRange',
    min: 0,
    step: 0.01,
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

function generateRowKey(item: BenjaminGrahamData): string {
  return `${item.ticker}-${item.companyName}`;
}

function EntryExitTable({ data, loading, error, initialTableState }: EntryExitTableProps) {
  const { t } = useTranslation();
  const { getEntryExitValue, getFieldValue, setFieldValue, commitField, initializeFromData } = useEntryExitValues();
  const { isAdmin } = useUserRole();
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [editingRow, setEditingRow] = useState<BenjaminGrahamData | null>(null);
  const [modalValues, setModalValues] = useState({
    entry1: '',
    entry2: '',
    exit1: '',
    exit2: '',
  });
  const [modalErrors, setModalErrors] = useState<Record<string, string>>({});
  const headerPaddingClass = 'px-2 py-2';

  // Initialize entry/exit values from data
  useEffect(() => {
    const entryExitData = data.map((item) => ({
      companyName: item.companyName,
      ticker: item.ticker,
      currency: 'USD',
      entry1: 0,
      entry2: 0,
      exit1: 0,
      exit2: 0,
      dateOfUpdate: null,
    }));
    initializeFromData(entryExitData);
  }, [data, initializeFromData]);

  // Check if ivFcf column should be shown
  const hasIvFcf = useMemo(() => {
    return data.some(item => item.ivFcf !== undefined);
  }, [data]);

  const handleCurrencyChange = useCallback((ticker: string, companyName: string, currency: string) => {
    setFieldValue(ticker, companyName, 'currency', currency);
  }, [setFieldValue]);

  // Helper functions for date checking
  const isDateOld = useCallback((dateString: string | null): boolean => {
    if (!dateString) return false;
    try {
      const dateParts = dateString.split('-');
      const date = new Date(
        parseInt(dateParts[0]),
        parseInt(dateParts[1]) - 1,
        parseInt(dateParts[2])
      );
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      date.setHours(0, 0, 0, 0);
      const daysDiff = (today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff > DATE_NEAR_OLD_THRESHOLD_DAYS;
    } catch (error) {
      return false;
    }
  }, []);

  const isDateNearOld = useCallback((dateString: string | null): boolean => {
    if (!dateString) return false;
    try {
      const dateParts = dateString.split('-');
      const date = new Date(
        parseInt(dateParts[0]),
        parseInt(dateParts[1]) - 1,
        parseInt(dateParts[2])
      );
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      date.setHours(0, 0, 0, 0);
      const daysDiff = (today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff >= 0 && daysDiff <= DATE_NEAR_OLD_THRESHOLD_DAYS && !isDateOld(dateString);
    } catch (error) {
      return false;
    }
  }, [isDateOld]);

  const openEditModal = useCallback((item: BenjaminGrahamData) => {
    const entry1Value = getFieldValue(item.ticker, item.companyName, 'entry1');
    const entry2Value = getFieldValue(item.ticker, item.companyName, 'entry2');
    const exit1Value = getFieldValue(item.ticker, item.companyName, 'exit1');
    const exit2Value = getFieldValue(item.ticker, item.companyName, 'exit2');

    setModalValues({
      entry1: entry1Value ? String(entry1Value) : '',
      entry2: entry2Value ? String(entry2Value) : '',
      exit1: exit1Value ? String(exit1Value) : '',
      exit2: exit2Value ? String(exit2Value) : '',
    });
    setModalErrors({});
    setEditingRow(item);
  }, [getFieldValue]);

  const closeEditModal = useCallback(() => {
    setEditingRow(null);
    setModalErrors({});
  }, []);

  const handleModalChange = useCallback((field: 'entry1' | 'entry2' | 'exit1' | 'exit2', value: string) => {
    setModalValues((prev) => ({ ...prev, [field]: value }));
    setModalErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const handleModalSave = useCallback(() => {
    if (!editingRow) return;
    const parsed = {
      entry1: parseFloat(modalValues.entry1),
      entry2: parseFloat(modalValues.entry2),
      exit1: parseFloat(modalValues.exit1),
      exit2: parseFloat(modalValues.exit2),
    };
    const values = {
      entry1: Number.isFinite(parsed.entry1) ? parsed.entry1 : 0,
      entry2: Number.isFinite(parsed.entry2) ? parsed.entry2 : 0,
      exit1: Number.isFinite(parsed.exit1) ? parsed.exit1 : 0,
      exit2: Number.isFinite(parsed.exit2) ? parsed.exit2 : 0,
    };

    const nextErrors: Record<string, string> = {};
    (Object.keys(values) as Array<keyof typeof values>).forEach((field) => {
      const validation = validateEntryExitValue(field, values[field]);
      if (!validation.isValid) {
        nextErrors[field] = validation.error || 'Invalid value';
      }
    });

    if (Object.keys(nextErrors).length > 0) {
      setModalErrors(nextErrors);
      return;
    }

    setFieldValue(editingRow.ticker, editingRow.companyName, 'entry1', values.entry1);
    setFieldValue(editingRow.ticker, editingRow.companyName, 'entry2', values.entry2);
    setFieldValue(editingRow.ticker, editingRow.companyName, 'exit1', values.exit1);
    setFieldValue(editingRow.ticker, editingRow.companyName, 'exit2', values.exit2);
    closeEditModal();
  }, [closeEditModal, editingRow, modalValues, setFieldValue]);

  // Calculate RR1: (Exit1 - Entry1) / Entry1 * 100
  const calculateRR1 = useCallback((entry1: number, exit1: number): number | null => {
    if (!entry1 || !exit1 || entry1 === 0) return null;
    const rr1 = ((exit1 - entry1) / entry1) * 100;
    return isNaN(rr1) || !isFinite(rr1) ? null : rr1;
  }, []);

  // Get color for RR1 cell based on conditions
  const getRR1Color = useCallback((rr1: number | null, price: number | null, entry1: number): string | null => {
    if (rr1 !== null && rr1 > RR1_GREEN_THRESHOLD_PERCENT && price !== null && price > 0 && entry1 > 0 && price <= entry1 * PRICE_TOLERANCE_GREEN) {
      return 'text-green-700 dark:text-green-200 bg-green-50 dark:bg-green-900/20';
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
      return 'text-green-700 dark:text-green-200 bg-green-50 dark:bg-green-900/20';
    }
    return null;
  }, []);

  // Custom header renderer with ColumnTooltip
  const renderHeader = useCallback((props: HeaderRenderProps<BenjaminGrahamData>) => {
    const { 
      column, 
      sortConfig, 
      handleSort, 
      getSortIcon, 
      getStickyPosition, 
      openFilterMenuColumn,
      setOpenFilterMenuColumn,
      hasActiveColumnFilter,
      getColumnUniqueValues,
      columnFilters,
      setColumnFilter,
      handleColumnSort,
      headerRefs,
    } = props;
    const metadata = getColumnMetadata('benjamin-graham', column.key);
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
          className={`${headerPaddingClass} text-left text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider ${stickyClass} bg-gray-50 dark:bg-gray-900`}
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
        className={`${headerPaddingClass} text-left text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-200 transition-all duration-200 ${stickyClass} bg-gray-50 dark:bg-gray-900`}
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
                {sortIcon && <span className="text-gray-600 dark:text-gray-300">{sortIcon}</span>}
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

  // Render cell content
  const renderCell = useCallback((item: BenjaminGrahamData, column: ColumnDefinition<BenjaminGrahamData>, index: number, globalIndex: number) => {
    // Use getFieldValue for individual fields (supports draft)
    const entry1Value = getFieldValue(item.ticker, item.companyName, 'entry1');
    const entry2Value = getFieldValue(item.ticker, item.companyName, 'entry2');
    const exit1Value = getFieldValue(item.ticker, item.companyName, 'exit1');
    const exit2Value = getFieldValue(item.ticker, item.companyName, 'exit2');
    const currencyValue = getFieldValue(item.ticker, item.companyName, 'currency');
    const dateOfUpdateValue = getFieldValue(item.ticker, item.companyName, 'dateOfUpdate');
    
    // Validate types with type guards
    const entry1 = isNumber(entry1Value) ? entry1Value : 0;
    const entry2 = isNumber(entry2Value) ? entry2Value : 0;
    const exit1 = isNumber(exit1Value) ? exit1Value : 0;
    const exit2 = isNumber(exit2Value) ? exit2Value : 0;
    const currency = isString(currencyValue) ? currencyValue : '';
    const dateOfUpdate = isString(dateOfUpdateValue) || dateOfUpdateValue === null ? dateOfUpdateValue : null;
    const values = { entry1, entry2, exit1, exit2, currency, dateOfUpdate };

    switch (column.key) {
      case 'antal':
        return globalIndex + 1;
      case 'companyName':
        return <span className="font-medium">{item.companyName}</span>;
      case 'ticker':
        return <span className="text-gray-600 dark:text-gray-300">{item.ticker}</span>;
      case 'currency':
        if (!isAdmin) {
          return <span className="text-black dark:text-white">{values.currency || 'USD'}</span>;
        }
        const currencyKey = `${item.ticker}-${item.companyName}-currency`;
        const currencyError = validationErrors[currencyKey];
        return (
          <div className="flex flex-col items-center">
            <select
              value={values.currency || 'USD'}
              onChange={(e) => {
                const validation = validateEntryExitValue('currency', e.target.value);
                if (validation.isValid) {
                  handleCurrencyChange(item.ticker, item.companyName, e.target.value);
                  setValidationErrors((prev) => {
                    const next = { ...prev };
                    delete next[currencyKey];
                    return next;
                  });
                } else {
                  setValidationErrors((prev) => ({ ...prev, [currencyKey]: validation.error || 'Invalid currency' }));
                }
              }}
              onBlur={() => {
                const validation = validateEntryExitValue('currency', values.currency);
                if (validation.isValid) {
                  commitField(item.ticker, item.companyName, 'currency');
                }
              }}
              className={`px-3 py-1 text-sm border rounded-md bg-white dark:bg-gray-700 text-black dark:text-white focus:outline-none focus:ring-2 focus:border-transparent ${
                currencyError
                  ? 'border-red-500 dark:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
              }`}
              onClick={(e) => e.stopPropagation()}
              aria-invalid={!!currencyError}
            >
              {CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
            {currencyError && (
              <span className="text-xs text-red-600 dark:text-red-400 mt-1" role="alert">
                {currencyError}
              </span>
            )}
          </div>
        );
      case 'entry1':
        return <span className="text-black dark:text-white">{values.entry1 || '-'}</span>;
      case 'entry2':
        return <span className="text-black dark:text-white">{values.entry2 || '-'}</span>;
      case 'exit1':
        return <span className="text-black dark:text-white">{values.exit1 || '-'}</span>;
      case 'exit2':
        return <span className="text-black dark:text-white">{values.exit2 || '-'}</span>;
      case 'actions':
        if (!isAdmin) {
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
      case 'dateOfUpdate':
        return (
          <span className={
            values.dateOfUpdate && 
            !(values.entry1 === 0 && values.entry2 === 0 && values.exit1 === 0 && values.exit2 === 0) &&
            isDateOld(values.dateOfUpdate)
              ? 'text-red-600 dark:text-red-400'
              : 'text-black dark:text-white'
          }>
            {values.dateOfUpdate || '-'}
          </span>
        );
      case 'price':
        return <span className="text-black dark:text-white">{item.price !== null ? item.price.toLocaleString() : 'N/A'}</span>;
      case 'benjaminGraham':
        return (
          <span className={
            item.benjaminGraham === null
              ? 'text-black dark:text-white'
              : item.benjaminGraham < 0 
              ? 'text-red-700 dark:text-red-400'
              : item.benjaminGraham > 0 && 
                item.price !== null && item.price > 0 && 
                item.price <= item.benjaminGraham * PRICE_TOLERANCE_GREEN
              ? 'text-green-700 dark:text-green-200'
              : item.benjaminGraham > 0 && 
                item.price !== null && item.price > 0 && 
                item.price <= item.benjaminGraham * PRICE_TOLERANCE_BLUE
              ? 'text-blue-700 dark:text-blue-400'
              : 'text-black dark:text-white'
          }>
            {item.benjaminGraham !== null ? item.benjaminGraham.toLocaleString() : 'N/A'}
          </span>
        );
      case 'ivFcf':
        if (!hasIvFcf) return null;
        return <span className="text-black dark:text-white">{item.ivFcf !== null && item.ivFcf !== undefined ? item.ivFcf.toLocaleString() : 'N/A'}</span>;
      case 'irr1':
        {
          const entryExitValues = getEntryExitValue(item.ticker, item.companyName);
          const entry1 = entryExitValues?.entry1 || 0;
          const exit1 = entryExitValues?.exit1 || 0;
          const rr1 = calculateRR1(entry1, exit1);
          const colorClass = getRR1Color(rr1, item.price, entry1);
          return (
            <span className={colorClass || 'text-black dark:text-white'}>
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
            <span className={colorClass || 'text-black dark:text-white'}>
              {rr2 !== null ? `${Math.round(rr2)}%` : 'N/A'}
            </span>
          );
        }
      default:
        return null;
    }
  }, [getFieldValue, getEntryExitValue, calculateRR1, calculateRR2, getRR1Color, getRR2Color, hasIvFcf, handleCurrencyChange, commitField, isDateOld, isDateNearOld, isAdmin, validationErrors, openEditModal]);

  // Render mobile card
  const renderMobileCard = useCallback((item: BenjaminGrahamData, index: number, globalIndex: number, isExpanded: boolean, toggleExpand: () => void) => {
    const rowKey = generateRowKey(item);
    const rowBgClass = globalIndex % 2 === 0 
      ? 'bg-white dark:bg-gray-800' 
      : 'bg-gray-50 dark:bg-gray-800/50';

    const entryExitValues = getEntryExitValue(item.ticker, item.companyName);
    const entry1 = entryExitValues?.entry1 || 0;
    const exit1 = entryExitValues?.exit1 || 0;
    const entry2 = entryExitValues?.entry2 || 0;
    const exit2 = entryExitValues?.exit2 || 0;
    const currency = entryExitValues?.currency || 'USD';
    const dateOfUpdate = entryExitValues?.dateOfUpdate || null;
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
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Currency</span>
              {isAdmin ? (
                <select
                  value={currency || 'USD'}
                  onChange={(e) => handleCurrencyChange(item.ticker, item.companyName, e.target.value)}
                  onBlur={() => commitField(item.ticker, item.companyName, 'currency')}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onClick={(e) => e.stopPropagation()}
                >
                  {CURRENCIES.map((curr) => (
                    <option key={curr} value={curr}>
                      {curr}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-sm text-black dark:text-white">{currency || 'USD'}</span>
              )}
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
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">ENTRY1</span>
              <span className="text-sm text-black dark:text-white">{entry1 || '-'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">ENTRY2</span>
              <span className="text-sm text-black dark:text-white">{entry2 || '-'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">EXIT1</span>
              <span className="text-sm text-black dark:text-white">{exit1 || '-'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">EXIT2</span>
              <span className="text-sm text-black dark:text-white">{exit2 || '-'}</span>
            </div>
            {isAdmin && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditModal(item);
                  }}
                  className="w-full px-3 py-2 text-sm font-medium text-blue-700 dark:text-blue-200 bg-blue-50 dark:bg-blue-900/20 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                >
                  Edit Entry/Exit
                </button>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date of Update</span>
              <span className={`text-sm text-center ${
                dateOfUpdate && 
                !(entry1 === 0 && entry2 === 0 && exit1 === 0 && exit2 === 0) &&
                isDateOld(dateOfUpdate)
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-black dark:text-white'
              }`}>
                {dateOfUpdate || '-'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Price</span>
              <span className="text-sm text-black dark:text-white">
                {item.price !== null ? item.price.toLocaleString() : 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Benjamin Graham</span>
              <span className={`text-sm text-center ${
                item.benjaminGraham === null
                  ? 'text-black dark:text-white'
                  : item.benjaminGraham < 0 
                  ? 'text-red-700 dark:text-red-300'
                  : item.benjaminGraham > 0 && 
                    item.price !== null && item.price > 0 && 
                    item.price <= item.benjaminGraham * PRICE_TOLERANCE_GREEN
                  ? 'text-green-700 dark:text-green-200'
                  : item.benjaminGraham > 0 && 
                    item.price !== null && item.price > 0 && 
                    item.price <= item.benjaminGraham * PRICE_TOLERANCE_BLUE
                  ? 'text-blue-700 dark:text-blue-400'
                  : 'text-black dark:text-white'
              }`}>
                {item.benjaminGraham !== null ? item.benjaminGraham.toLocaleString() : 'N/A'}
              </span>
            </div>
            {hasIvFcf && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">IV (FCF)</span>
                <span className="text-sm text-black dark:text-white">
                  {item.ivFcf !== null && item.ivFcf !== undefined ? item.ivFcf.toLocaleString() : 'N/A'}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">RR1</span>
              <span className={`text-sm ${rr1Color || 'text-black dark:text-white'}`}>
                {rr1 !== null ? `${Math.round(rr1)}%` : 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">RR2</span>
              <span className={`text-sm ${rr2Color || 'text-black dark:text-white'}`}>
                {rr2 !== null ? `${Math.round(rr2)}%` : 'N/A'}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }, [getEntryExitValue, calculateRR1, calculateRR2, getRR1Color, getRR2Color, hasIvFcf, handleCurrencyChange, commitField, isDateOld, isDateNearOld, isAdmin, openEditModal]);

  // Filter columns based on ivFcf availability
  const filteredColumns = useMemo(() => {
    if (hasIvFcf) {
      return ENTRY_EXIT_COLUMNS;
    }
    return ENTRY_EXIT_COLUMNS.filter(col => col.key !== 'ivFcf');
  }, [hasIvFcf]);

  return (
    <>
      <BaseTable<BenjaminGrahamData>
        data={data}
        loading={loading}
        error={error}
        columns={filteredColumns}
        filters={ENTRY_EXIT_FILTERS}
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
        stickyColumns={['antal', 'companyName']}
        headerCellPaddingClass="px-2 py-2"
        cellPaddingClass="px-2 py-2"
        ariaLabel="Entry Exit"
        minTableWidth="100%"
        getRowKey={(item) => generateRowKey(item)}
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
          aria-labelledby="entry-exit-modal-title"
        >
          <div className="w-full max-w-lg rounded-lg bg-white dark:bg-gray-800 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
              <div>
                <h2 id="entry-exit-modal-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Edit Entry/Exit
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {editingRow.companyName} ({editingRow.ticker})
                </p>
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

            <div className="px-6 py-4 space-y-4">
              {(['entry1', 'entry2', 'exit1', 'exit2'] as const).map((field) => (
                <div key={field} className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    {field.toUpperCase()}
                  </label>
                  <input
                    type="number"
                    value={modalValues[field]}
                    onChange={(e) => handleModalChange(field, e.target.value)}
                    min={0}
                    max={1000000}
                    step={0.01}
                    className={`w-full rounded-md border px-3 py-2 text-sm bg-white dark:bg-gray-700 text-black dark:text-white focus:outline-none focus:ring-2 focus:border-transparent ${
                      modalErrors[field]
                        ? 'border-red-500 dark:border-red-500 focus:ring-red-500'
                        : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
                    }`}
                    aria-invalid={!!modalErrors[field]}
                  />
                  {modalErrors[field] && (
                    <p className="text-xs text-red-600 dark:text-red-400" role="alert">
                      {modalErrors[field]}
                    </p>
                  )}
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

export default React.memo(EntryExitTable);
