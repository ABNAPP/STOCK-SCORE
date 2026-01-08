import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { EntryExitData } from '../types/stock';
import BaseTable, { ColumnDefinition, HeaderRenderProps } from './BaseTable';
import ColumnTooltip from './ColumnTooltip';
import { getColumnMetadata } from '../config/tableMetadata';
import { FilterConfig } from './AdvancedFilters';
import { useEntryExitValues } from '../contexts/EntryExitContext';
import { useAuth } from '../contexts/AuthContext';
import { saveCurrencyValues, loadCurrencyValues } from '../services/userDataService';
import { DATE_NEAR_OLD_THRESHOLD_DAYS } from '../config/constants';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '../config/firebase';

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
  const { currentUser } = useAuth();
  const [currencyMap, setCurrencyMap] = useState<Map<string, string>>(new Map());
  const [isLoadingCurrency, setIsLoadingCurrency] = useState(true);
  const { getEntryExitValue, getFieldValue, setFieldValue, commitField, initializeFromData } = useEntryExitValues();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dirtyKeysRef = useRef<Set<string>>(new Set()); // Set of "ticker-companyName" that are being edited
  const isInitialLoadRef = useRef(true); // Track initial load to prevent listener from processing during load
  const dataRef = useRef(data); // Keep reference to latest data for use in listener

  // Update data ref when data changes
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const STORAGE_KEY = 'tachart-currency-map';

  // Load currency values from Firestore and set up real-time listener
  useEffect(() => {
    if (!currentUser) {
      // If no user, just load from localStorage
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsedMap = JSON.parse(stored);
          const savedMap = new Map(Object.entries(parsedMap));
          setCurrencyMap((prev) => {
            const newMap = new Map(savedMap);
            dataRef.current.forEach((item) => {
              const key = `${item.ticker}-${item.companyName}`;
              if (!newMap.has(key)) {
                newMap.set(key, item.currency || 'USD');
              }
            });
            return newMap;
          });
        }
      } catch (error) {
        console.error('Failed to load currency map from localStorage:', error);
      }
      setIsLoadingCurrency(false);
      isInitialLoadRef.current = false;
      return;
    }

    const loadCurrencyData = async () => {
      setIsLoadingCurrency(true);
      isInitialLoadRef.current = true;
      try {
        const loaded = await loadCurrencyValues(currentUser);
        let savedMap = new Map<string, string>();
        
        if (loaded) {
          savedMap = new Map(Object.entries(loaded));
        } else {
          // Fallback to localStorage
          try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
              const parsedMap = JSON.parse(stored);
              savedMap = new Map(Object.entries(parsedMap));
            }
          } catch (error) {
            console.error('Failed to parse currency map from localStorage:', error);
          }
        }

        setCurrencyMap((prev) => {
          const newMap = new Map(savedMap);
          dataRef.current.forEach((item) => {
            const key = `${item.ticker}-${item.companyName}`;
            if (!newMap.has(key)) {
              newMap.set(key, item.currency || 'USD');
            }
          });
          return newMap;
        });
      } catch (error) {
        console.error('Failed to load currency map:', error);
        // Fallback to localStorage
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          let savedMap = new Map<string, string>();
          if (stored) {
            const parsedMap = JSON.parse(stored);
            savedMap = new Map(Object.entries(parsedMap));
          }
          setCurrencyMap((prev) => {
            const newMap = new Map(savedMap);
            dataRef.current.forEach((item) => {
              const key = `${item.ticker}-${item.companyName}`;
              if (!newMap.has(key)) {
                newMap.set(key, item.currency || 'USD');
              }
            });
            return newMap;
          });
        } catch (localError) {
          console.error('Failed to initialize currency map from localStorage:', localError);
        }
      } finally {
        setIsLoadingCurrency(false);
        // Mark initial load as complete after a short delay to ensure data is set
        setTimeout(() => {
          isInitialLoadRef.current = false;
        }, 100);
      }
    };

    loadCurrencyData();

    // Set up real-time listener for changes from other devices
    const docRef = doc(db, 'userData', currentUser.uid, 'currency', 'data');
    const unsubscribe = onSnapshot(
      docRef,
      (docSnapshot) => {
        // Skip during initial load
        if (isInitialLoadRef.current) {
          return;
        }
        
        // Ignore our own pending writes
        if (docSnapshot.metadata.hasPendingWrites) {
          return;
        }
        
        if (docSnapshot.exists()) {
          const snapshotData = docSnapshot.data();
          const remoteValues = snapshotData.values || {};
          
          // MERGE remote changes instead of replacing everything
          setCurrencyMap((prev) => {
            const newMap = new Map(prev);
            let hasChanges = false;
            
            // Process each remote value
            for (const [key, remoteCurrency] of Object.entries(remoteValues)) {
              // If this key is dirty (being edited), keep the local value
              if (dirtyKeysRef.current.has(key)) {
                continue; // Skip this key, keep local value
              }
              
              // Otherwise, use remote value if it's different
              const currentCurrency = newMap.get(key);
              if (remoteCurrency !== currentCurrency) {
                newMap.set(key, remoteCurrency as string);
                hasChanges = true;
              }
            }
            
            if (hasChanges) {
              // Also update localStorage
              try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(newMap)));
              } catch (error) {
                console.error('Failed to save currency map to localStorage:', error);
              }
              // Merge with data defaults (use current data from ref)
              const mergedMap = new Map(newMap);
              dataRef.current.forEach((item) => {
                const key = `${item.ticker}-${item.companyName}`;
                if (!mergedMap.has(key)) {
                  mergedMap.set(key, item.currency || 'USD');
                }
              });
              return mergedMap;
            }
            return prev;
          });
        }
      },
      (error) => {
        console.error('Error listening to Currency values:', error);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [currentUser?.uid]); // Removed data from dependencies - listener should only recreate when user changes

  // Initialize entry/exit values from data
  useEffect(() => {
    initializeFromData(data);
  }, [data, initializeFromData]);

  // Save currency values to Firestore when they change (debounced)
  useEffect(() => {
    if (isLoadingCurrency || !currentUser) return; // Don't save during initial load

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Save to localStorage immediately (fast fallback)
    try {
      const mapObject = Object.fromEntries(currencyMap);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mapObject));
    } catch (error) {
      console.error('Failed to save currency map to localStorage:', error);
    }

    // Debounce Firestore save to avoid too many writes
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const mapObject = Object.fromEntries(currencyMap);
        await saveCurrencyValues(currentUser, mapObject);
        // After successful save, clear dirty keys for all keys that were saved
        // This allows future remote updates to come through
        dirtyKeysRef.current.clear();
      } catch (error) {
        console.error('Error saving currency values to Firestore:', error);
        // On error, keep dirty keys so user's edits aren't lost
      }
    }, 1000); // Wait 1 second after last change

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [currencyMap, currentUser, isLoadingCurrency]);

  const handleCurrencyChange = useCallback((ticker: string, companyName: string, currency: string) => {
    const key = `${ticker}-${companyName}`;
    // Mark this key as dirty BEFORE state update
    dirtyKeysRef.current.add(key);
    setCurrencyMap((prev) => {
      const newMap = new Map(prev);
      newMap.set(key, currency);
      return newMap;
    });
  }, []);

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
    setFieldValue(ticker, companyName, field, value);
  }, [setFieldValue]);

  // Create data with current currency and entry/exit values
  const dataWithValues: EntryExitData[] = useMemo(() => {
    return data.map((item) => {
      const key = `${item.ticker}-${item.companyName}`;
      const values = getEntryExitValue(item.ticker, item.companyName) || { entry1: 0, entry2: 0, exit1: 0, exit2: 0, dateOfUpdate: null };
      return {
        ...item,
        currency: currencyMap.get(key) || item.currency || 'USD',
        entry1: values.entry1,
        entry2: values.entry2,
        exit1: values.exit1,
        exit2: values.exit2,
        dateOfUpdate: values.dateOfUpdate,
      };
    });
  }, [data, currencyMap, getEntryExitValue]);

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
    const key = `${item.ticker}-${item.companyName}`;
    const currentCurrency = currencyMap.get(key) || item.currency || 'USD';
    // Use getFieldValue for individual fields (supports draft)
    const entry1 = getFieldValue(item.ticker, item.companyName, 'entry1') as number;
    const entry2 = getFieldValue(item.ticker, item.companyName, 'entry2') as number;
    const exit1 = getFieldValue(item.ticker, item.companyName, 'exit1') as number;
    const exit2 = getFieldValue(item.ticker, item.companyName, 'exit2') as number;
    const dateOfUpdate = getFieldValue(item.ticker, item.companyName, 'dateOfUpdate') as string | null;
    const values = { entry1, entry2, exit1, exit2, dateOfUpdate };

    switch (column.key) {
      case 'antal':
        return globalIndex + 1;
      case 'companyName':
        return <span className="font-medium">{item.companyName}</span>;
      case 'ticker':
        return <span className="text-gray-600 dark:text-gray-300">{item.ticker}</span>;
      case 'currency':
        return (
          <select
            value={currentCurrency}
            onChange={(e) => handleCurrencyChange(item.ticker, item.companyName, e.target.value)}
            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            onClick={(e) => e.stopPropagation()}
          >
            {CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        );
      case 'entry1':
        return (
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
        );
      case 'entry2':
        return (
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
        );
      case 'exit1':
        return (
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
        );
      case 'exit2':
        return (
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
  }, [currencyMap, getFieldValue, handleCurrencyChange, handleEntryExitChange, commitField, isDateOld, isDateNearOld]);

  // Render mobile card with expandable view
  const renderMobileCard = useCallback((item: EntryExitData, index: number, globalIndex: number, isExpanded: boolean, toggleExpand: () => void) => {
    const key = `${item.ticker}-${item.companyName}`;
    const currentCurrency = currencyMap.get(key) || item.currency || 'USD';
    const values = getEntryExitValue(item.ticker, item.companyName) || { entry1: 0, entry2: 0, exit1: 0, exit2: 0, dateOfUpdate: null };
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
              <select
                value={currentCurrency}
                onChange={(e) => handleCurrencyChange(item.ticker, item.companyName, e.target.value)}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onClick={(e) => e.stopPropagation()}
              >
                {CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={toggleExpand}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-all duration-200 flex-shrink-0"
            aria-label={isExpanded ? 'Dölj detaljer' : 'Visa detaljer'}
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
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">ENTRY2</span>
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
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">EXIT1</span>
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
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">EXIT2</span>
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
  }, [currencyMap, getFieldValue, handleCurrencyChange, handleEntryExitChange, commitField, isDateOld, isDateNearOld]);

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
