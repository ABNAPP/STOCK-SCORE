import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntryExitData } from '../types/stock';
import BaseTable, { ColumnDefinition, HeaderRenderProps } from './BaseTable';
import ColumnTooltip from './ColumnTooltip';
import { getColumnMetadata } from '../config/tableMetadata';
import { FilterConfig } from './AdvancedFilters';
import { useEntryExitValues } from '../contexts/EntryExitContext';
import { useUserRole } from '../hooks/useUserRole';
import { DATE_NEAR_OLD_THRESHOLD_DAYS } from '../config/constants';
import { isNumber, isString } from '../utils/typeGuards';
import { validateEntryExitValue } from '../utils/inputValidator';

interface EntryExitTableProps {
  data: EntryExitData[];
  loading: boolean;
  error: string | null;
}

const CURRENCIES = ['USD', 'EUR', 'SEK', 'DKK', 'NOK', 'GBP', 'AUD', 'CAD', 'NZD'];

const ENTRY_EXIT_COLUMNS: ColumnDefinition[] = [
  { key: 'antal', label: 'Antal', required: true, sticky: true, sortable: false },
  { key: 'companyName', label: 'Company Name', required: true, sticky: true, sortable: true },
  { key: 'ticker', label: 'Ticker', required: true, sticky: true, sortable: true },
  { key: 'currency', label: 'Currency', required: true, sticky: true, sortable: true, align: 'center' },
  { key: 'entry1', label: 'ENTRY1', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'entry2', label: 'ENTRY2', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'exit1', label: 'EXIT1', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'exit2', label: 'EXIT2', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'dateOfUpdate', label: 'Date of Update', defaultVisible: true, sortable: true, align: 'center' },
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
];

export default function EntryExitTable({ data, loading, error }: EntryExitTableProps) {
  const { t } = useTranslation();
  const { getEntryExitValue, getFieldValue, setFieldValue, commitField, initializeFromData } = useEntryExitValues();
  const { isEditor } = useUserRole();
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Initialize entry/exit values from data
  useEffect(() => {
    initializeFromData(data);
  }, [data, initializeFromData]);

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
      return date.getTime() < today.getTime();
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

  const handleEntryExitChange = useCallback((ticker: string, companyName: string, field: 'entry1' | 'entry2' | 'exit1' | 'exit2', value: number) => {
    // Validate before setting
    const validation = validateEntryExitValue(field, value);
    const key = `${ticker}-${companyName}-${field}`;
    
    if (!validation.isValid) {
      setValidationErrors((prev) => ({ ...prev, [key]: validation.error || 'Invalid value' }));
      // Still allow the change but mark it as invalid
      // User will see error and can correct it
    } else {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
    
    setFieldValue(ticker, companyName, field, value);
  }, [setFieldValue]);

  // Create data with current currency and entry/exit values
  const dataWithValues: EntryExitData[] = useMemo(() => {
    return data.map((item) => {
      const values = getEntryExitValue(item.ticker, item.companyName) || { entry1: 0, entry2: 0, exit1: 0, exit2: 0, currency: 'USD', dateOfUpdate: null };
      return {
        ...item,
        currency: values.currency,
        entry1: values.entry1,
        entry2: values.entry2,
        exit1: values.exit1,
        exit2: values.exit2,
        dateOfUpdate: values.dateOfUpdate,
      };
    });
  }, [data, getEntryExitValue]);

  // Custom header renderer with ColumnTooltip
  const renderHeader = useCallback((props: HeaderRenderProps) => {
    const { column, sortConfig, handleSort, getSortIcon, getStickyPosition } = props;
    const metadata = getColumnMetadata('sma-100', column.key);
    const isSticky = column.sticky;
    const isSorted = sortConfig.key === column.key;
    const sortIcon = getSortIcon(column.key);
    const stickyClass = isSticky ? `sm:sticky sm:top-0 ${getStickyPosition(column.key)} z-50` : '';
    
    if (!column.sortable) {
      return (
        <th
          className={`px-6 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider ${stickyClass} bg-gray-50 dark:bg-gray-900`}
          scope="col"
          role="columnheader"
        >
          {column.label}
        </th>
      );
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSort(column.key);
      }
    };

    return (
      <th
        onClick={() => handleSort(column.key)}
        onKeyDown={handleKeyDown}
        className={`px-6 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${stickyClass} bg-gray-50 dark:bg-gray-900`}
        scope="col"
        role="columnheader"
        tabIndex={0}
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
  }, []);

  // Render cell content
  const renderCell = useCallback((item: EntryExitData, column: ColumnDefinition, index: number, globalIndex: number) => {
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
        if (!isEditor) {
          return <span className="text-gray-900 dark:text-gray-100">{values.currency || 'USD'}</span>;
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
              className={`px-3 py-1 text-sm border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:border-transparent ${
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
        if (!isEditor) {
          return <span className="text-gray-900 dark:text-gray-100">{values.entry1 || '-'}</span>;
        }
        const entry1Key = `${item.ticker}-${item.companyName}-entry1`;
        const entry1Error = validationErrors[entry1Key];
        return (
          <div className="flex flex-col items-center">
            <input
              type="number"
              value={values.entry1 || ''}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 0;
                handleEntryExitChange(item.ticker, item.companyName, 'entry1', value);
              }}
              onBlur={() => {
                // Validate before committing
                const validation = validateEntryExitValue('entry1', values.entry1);
                if (validation.isValid) {
                  commitField(item.ticker, item.companyName, 'entry1');
                }
              }}
              min={0}
              max={1000000}
              step={0.01}
              className={`px-3 py-1 text-sm border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:border-transparent w-24 text-center ${
                entry1Error
                  ? 'border-red-500 dark:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
              }`}
              onClick={(e) => e.stopPropagation()}
              aria-invalid={!!entry1Error}
            />
            {entry1Error && (
              <span className="text-xs text-red-600 dark:text-red-400 mt-1" role="alert">
                {entry1Error}
              </span>
            )}
          </div>
        );
      case 'entry2':
        if (!isEditor) {
          return <span className="text-gray-900 dark:text-gray-100">{values.entry2 || '-'}</span>;
        }
        const entry2Key = `${item.ticker}-${item.companyName}-entry2`;
        const entry2Error = validationErrors[entry2Key];
        return (
          <div className="flex flex-col items-center">
            <input
              type="number"
              value={values.entry2 || ''}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 0;
                handleEntryExitChange(item.ticker, item.companyName, 'entry2', value);
              }}
              onBlur={() => {
                const validation = validateEntryExitValue('entry2', values.entry2);
                if (validation.isValid) {
                  commitField(item.ticker, item.companyName, 'entry2');
                }
              }}
              min={0}
              max={1000000}
              step={0.01}
              className={`px-3 py-1 text-sm border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:border-transparent w-24 text-center ${
                entry2Error
                  ? 'border-red-500 dark:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
              }`}
              onClick={(e) => e.stopPropagation()}
              aria-invalid={!!entry2Error}
            />
            {entry2Error && (
              <span className="text-xs text-red-600 dark:text-red-400 mt-1" role="alert">
                {entry2Error}
              </span>
            )}
          </div>
        );
      case 'exit1':
        if (!isEditor) {
          return <span className="text-gray-900 dark:text-gray-100">{values.exit1 || '-'}</span>;
        }
        const exit1Key = `${item.ticker}-${item.companyName}-exit1`;
        const exit1Error = validationErrors[exit1Key];
        return (
          <div className="flex flex-col items-center">
            <input
              type="number"
              value={values.exit1 || ''}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 0;
                handleEntryExitChange(item.ticker, item.companyName, 'exit1', value);
              }}
              onBlur={() => {
                const validation = validateEntryExitValue('exit1', values.exit1);
                if (validation.isValid) {
                  commitField(item.ticker, item.companyName, 'exit1');
                }
              }}
              min={0}
              max={1000000}
              step={0.01}
              className={`px-3 py-1 text-sm border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:border-transparent w-24 text-center ${
                exit1Error
                  ? 'border-red-500 dark:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
              }`}
              onClick={(e) => e.stopPropagation()}
              aria-invalid={!!exit1Error}
            />
            {exit1Error && (
              <span className="text-xs text-red-600 dark:text-red-400 mt-1" role="alert">
                {exit1Error}
              </span>
            )}
          </div>
        );
      case 'exit2':
        if (!isEditor) {
          return <span className="text-gray-900 dark:text-gray-100">{values.exit2 || '-'}</span>;
        }
        const exit2Key = `${item.ticker}-${item.companyName}-exit2`;
        const exit2Error = validationErrors[exit2Key];
        return (
          <div className="flex flex-col items-center">
            <input
              type="number"
              value={values.exit2 || ''}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 0;
                handleEntryExitChange(item.ticker, item.companyName, 'exit2', value);
              }}
              onBlur={() => {
                const validation = validateEntryExitValue('exit2', values.exit2);
                if (validation.isValid) {
                  commitField(item.ticker, item.companyName, 'exit2');
                }
              }}
              min={0}
              max={1000000}
              step={0.01}
              className={`px-3 py-1 text-sm border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:border-transparent w-24 text-center ${
                exit2Error
                  ? 'border-red-500 dark:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
              }`}
              onClick={(e) => e.stopPropagation()}
              aria-invalid={!!exit2Error}
            />
            {exit2Error && (
              <span className="text-xs text-red-600 dark:text-red-400 mt-1" role="alert">
                {exit2Error}
              </span>
            )}
          </div>
        );
      case 'dateOfUpdate':
        return (
          <span className={
            values.dateOfUpdate && 
            !(values.entry1 === 0 && values.entry2 === 0 && values.exit1 === 0 && values.exit2 === 0) &&
            isDateOld(values.dateOfUpdate)
              ? 'text-red-600 dark:text-red-400'
              : values.dateOfUpdate && 
                !(values.entry1 === 0 && values.entry2 === 0 && values.exit1 === 0 && values.exit2 === 0) &&
                isDateNearOld(values.dateOfUpdate)
              ? 'text-blue-700 dark:text-blue-400'
              : 'text-gray-900 dark:text-gray-100'
          }>
            {values.dateOfUpdate || '-'}
          </span>
        );
      default:
        return null;
    }
  }, [getFieldValue, handleCurrencyChange, handleEntryExitChange, commitField, isDateOld, isDateNearOld, isEditor]);

  // Render mobile card with expandable view
  const renderMobileCard = useCallback((item: EntryExitData, index: number, globalIndex: number, isExpanded: boolean, toggleExpand: () => void) => {
    const values = getEntryExitValue(item.ticker, item.companyName) || { entry1: 0, entry2: 0, exit1: 0, exit2: 0, currency: 'USD', dateOfUpdate: null };
    const rowBgClass = globalIndex % 2 === 0 
      ? 'bg-white dark:bg-gray-800' 
      : 'bg-gray-50 dark:bg-gray-800/50';

    return (
      <div className={`${rowBgClass} rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm transition-all duration-300 ease-in-out`}>
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
              <span className="text-sm text-gray-500 dark:text-gray-300">{item.ticker}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Currency</span>
              {isEditor ? (
                <select
                  value={values.currency || 'USD'}
                  onChange={(e) => handleCurrencyChange(item.ticker, item.companyName, e.target.value)}
                  onBlur={() => commitField(item.ticker, item.companyName, 'currency')}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onClick={(e) => e.stopPropagation()}
                >
                  {CURRENCIES.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-sm text-gray-900 dark:text-gray-100">{values.currency || 'USD'}</span>
              )}
            </div>
          </div>
          <button
            onClick={toggleExpand}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-all duration-200 flex-shrink-0"
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
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">ENTRY1</span>
              {isEditor ? (
                <input
                  type="number"
                  value={values.entry1 || ''}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    handleEntryExitChange(item.ticker, item.companyName, 'entry1', value);
                  }}
                  onBlur={() => commitField(item.ticker, item.companyName, 'entry1')}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-24 text-center"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="text-sm text-gray-900 dark:text-gray-100">{values.entry1 || '-'}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">ENTRY2</span>
              {isEditor ? (
                <input
                  type="number"
                  value={values.entry2 || ''}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    handleEntryExitChange(item.ticker, item.companyName, 'entry2', value);
                  }}
                  onBlur={() => commitField(item.ticker, item.companyName, 'entry2')}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-24 text-center"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="text-sm text-gray-900 dark:text-gray-100">{values.entry2 || '-'}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">EXIT1</span>
              {isEditor ? (
                <input
                  type="number"
                  value={values.exit1 || ''}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    handleEntryExitChange(item.ticker, item.companyName, 'exit1', value);
                  }}
                  onBlur={() => commitField(item.ticker, item.companyName, 'exit1')}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-24 text-center"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="text-sm text-gray-900 dark:text-gray-100">{values.exit1 || '-'}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">EXIT2</span>
              {isEditor ? (
                <input
                  type="number"
                  value={values.exit2 || ''}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    handleEntryExitChange(item.ticker, item.companyName, 'exit2', value);
                  }}
                  onBlur={() => commitField(item.ticker, item.companyName, 'exit2')}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-24 text-center"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="text-sm text-gray-900 dark:text-gray-100">{values.exit2 || '-'}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date of Update</span>
              <span className={`text-sm text-center ${
                values.dateOfUpdate && 
                !(values.entry1 === 0 && values.entry2 === 0 && values.exit1 === 0 && values.exit2 === 0) &&
                isDateOld(values.dateOfUpdate)
                  ? 'text-red-600 dark:text-red-400'
                  : values.dateOfUpdate && 
                    !(values.entry1 === 0 && values.entry2 === 0 && values.exit1 === 0 && values.exit2 === 0) &&
                    isDateNearOld(values.dateOfUpdate)
                  ? 'text-blue-700 dark:text-blue-400'
                  : 'text-gray-900 dark:text-gray-100'
              }`}>
                {values.dateOfUpdate || '-'}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }, [getEntryExitValue, handleCurrencyChange, handleEntryExitChange, commitField, isDateOld, isDateNearOld, isEditor]);

  return (
    <BaseTable<EntryExitData>
      data={dataWithValues}
      loading={loading}
      error={error}
      columns={ENTRY_EXIT_COLUMNS}
      filters={ENTRY_EXIT_FILTERS}
      tableId="entry-exit-entry1"
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
      stickyColumns={['antal', 'companyName', 'ticker', 'currency']}
      ariaLabel="Entry/Exit"
      minTableWidth="800px"
      getRowKey={(item, index) => `${item.ticker}-${item.companyName}-${index}`}
    />
  );
}
