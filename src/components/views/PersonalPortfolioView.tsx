import React, { useState, useEffect, useRef, useCallback, useMemo, Fragment } from 'react';
import { useShareableHydration } from '../../contexts/ShareableHydrationContext';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useBenjaminGrahamData } from '../../hooks/useBenjaminGrahamData';
import { EntryExitProvider, useEntryExitValues } from '../../contexts/EntryExitContext';
import { getUserPortfolio, addPortfolioItem, removePortfolioItem, updatePortfolioItem, getCurrencyForStock, computeAveragePriceUSD } from '../../services/personalPortfolioService';
import { getExchangeRate, refreshCurrencyRatesCache } from '../../services/currencyService';
import { PortfolioItem, PortfolioPosition } from '../../types/portfolio';
import { usePortfolioSearch, StockSearchResult } from '../../hooks/usePortfolioSearch';
import { useDebounce } from '../../hooks/useDebounce';
import { TableSkeleton } from '../SkeletonLoader';
import ProgressIndicator from '../ProgressIndicator';
import BaseTable, { ColumnDefinition, HeaderRenderProps } from '../BaseTable';
import ColumnFilterMenu from '../ColumnFilterMenu';
import ColumnTooltip from '../ColumnTooltip';
import { getColumnMetadata } from '../../config/tableMetadata';
import { DEFAULT_BROKERS, BROKER_OTHER } from '../../config/brokers';
import { PORTFOLIO_COLUMNS, type PortfolioTableItem } from './PersonalPortfolioColumns';
import { PersonalPortfolioExpandedRow } from './PersonalPortfolioExpandedRow';

const VIEW_ID = 'personal-portfolio';
const TABLE_ID = 'personal-portfolio';

// Inner component that uses EntryExitContext
function PersonalPortfolioViewInner() {
  const { t } = useTranslation();
  const { link, consume } = useShareableHydration();
  const { currentUser } = useAuth();
  const { data: benjaminGrahamData, loading: benjaminGrahamLoading } = useBenjaminGrahamData();
  const { entryExitValues, initializeFromData } = useEntryExitValues();
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStock, setSelectedStock] = useState<StockSearchResult | null>(null);
  const [quantity, setQuantity] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [investedAmount, setInvestedAmount] = useState('');
  const [investmentCurrency, setInvestmentCurrency] = useState<string>('USD');
  const [brokerSelect, setBrokerSelect] = useState<string>(DEFAULT_BROKERS[0]);
  const [brokerCustom, setBrokerCustom] = useState('');
  const [editingItem, setEditingItem] = useState<PortfolioTableItem | null>(null);
  const [editPositions, setEditPositions] = useState<PortfolioPosition[]>([]);
  const [editAveragePreview, setEditAveragePreview] = useState<number | null>(null);
  const [editAverageLoading, setEditAverageLoading] = useState(false);
  const [exchangeRatesByCurrency, setExchangeRatesByCurrency] = useState<Record<string, number>>({ USD: 1 });
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const headerRefs = useRef<{ [key: string]: HTMLElement | null }>({});

  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const searchResults = usePortfolioSearch(benjaminGrahamData || [], debouncedSearchQuery);

  // Initialize EntryExitContext with benjaminGrahamData
  useEffect(() => {
    if (benjaminGrahamData && benjaminGrahamData.length > 0) {
      const entryExitData = benjaminGrahamData.map((item) => ({
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
    }
  }, [benjaminGrahamData, initializeFromData]);

  const loadPortfolio = useCallback(async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      setError(null);
      const userPortfolio = await getUserPortfolio(currentUser.uid);
      setPortfolio(userPortfolio?.portfolio || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load portfolio';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    loadPortfolio();
  }, [currentUser, loadPortfolio]);

  // Periodic update of exchange rates and average recalculation from positions (every 15 minutes)
  useEffect(() => {
    if (!portfolio.length || !currentUser) return;

    const updateInterval = setInterval(async () => {
      try {
        await refreshCurrencyRatesCache();
      } catch {
        // ignore
      }

      const itemsWithPositions = portfolio.filter((item) => item.positions && item.positions.length > 0);
      for (const item of itemsWithPositions) {
        try {
          const newAveragePrice = await computeAveragePriceUSD(item.positions!);
          const currentAvg = item.averagePrice ?? null;
          const changed =
            newAveragePrice === null
              ? currentAvg !== null
              : currentAvg === null || Math.abs(currentAvg - newAveragePrice) > 0.01;
          if (changed) {
            await updatePortfolioItem(currentUser.uid, item.ticker, { positions: item.positions });
          }
        } catch {
          // ignore errors for individual items
        }
      }

      await loadPortfolio();
    }, 15 * 60 * 1000);

    return () => clearInterval(updateInterval);
  }, [portfolio, currentUser, loadPortfolio]);

  // Close search results when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    }

    if (showSearchResults) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSearchResults]);

  // Fetch exchange rates for non-USD currencies used in portfolio
  useEffect(() => {
    if (!portfolio.length) {
      setExchangeRatesByCurrency({ USD: 1 });
      return;
    }
    const currencies = new Set<string>();
    for (const item of portfolio) {
      const ccy = getCurrencyForStock(item.ticker, item.companyName, entryExitValues);
      if (ccy !== 'USD') currencies.add(ccy);
    }
    if (currencies.size === 0) {
      setExchangeRatesByCurrency({ USD: 1 });
      return;
    }
    let cancelled = false;
    (async () => {
      const rates: Record<string, number> = { USD: 1 };
      for (const ccy of currencies) {
        if (cancelled) return;
        const rate = await getExchangeRate(ccy, 'USD');
        if (rate !== null) rates[ccy] = rate;
      }
      if (!cancelled) setExchangeRatesByCurrency(rates);
    })();
    return () => {
      cancelled = true;
    };
  }, [portfolio, entryExitValues]);

  // Fetch any missing exchange rates (e.g. when entryExitValues loads after portfolio)
  useEffect(() => {
    if (!portfolio.length) return;
    const missing: string[] = [];
    for (const item of portfolio) {
      const ccy = getCurrencyForStock(item.ticker, item.companyName, entryExitValues);
      if (ccy !== 'USD' && exchangeRatesByCurrency[ccy] == null && !missing.includes(ccy)) {
        missing.push(ccy);
      }
    }
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const next: Record<string, number> = { ...exchangeRatesByCurrency };
      for (const ccy of missing) {
        if (cancelled) return;
        const rate = await getExchangeRate(ccy, 'USD');
        if (rate !== null) next[ccy] = rate;
      }
      if (!cancelled) setExchangeRatesByCurrency(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [portfolio, entryExitValues, exchangeRatesByCurrency]);

  // Show search results when query changes
  useEffect(() => {
    if (debouncedSearchQuery.trim().length >= 2 && searchResults.length > 0) {
      setShowSearchResults(true);
      setSelectedIndex(-1);
    } else {
      setShowSearchResults(false);
    }
  }, [debouncedSearchQuery, searchResults]);

  // Auto-calculate aggregate average (USD) from editPositions
  useEffect(() => {
    if (!editingItem || editPositions.length === 0) {
      setEditAveragePreview(null);
      return;
    }

    let cancelled = false;
    setEditAverageLoading(true);
    computeAveragePriceUSD(editPositions).then((avg) => {
      if (!cancelled) {
        setEditAveragePreview(avg);
      }
    }).finally(() => {
      if (!cancelled) setEditAverageLoading(false);
    });
    return () => { cancelled = true; };
  }, [editingItem, editPositions]);

  // Handle keyboard navigation in search results
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSearchResults || searchResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
        handleSelectStock(searchResults[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowSearchResults(false);
      setSelectedIndex(-1);
    }
  };

  const handleSelectStock = (stock: StockSearchResult) => {
    setSelectedStock(stock);
    setSearchQuery(`${stock.ticker} - ${stock.companyName}`);
    setShowSearchResults(false);
    setSelectedIndex(-1);
    // Focus quantity input
    setTimeout(() => {
      const quantityInput = document.getElementById('quantity-input');
      quantityInput?.focus();
    }, 100);
  };

  const handleAddItem = async () => {
    if (!currentUser || !selectedStock || !quantity.trim()) return;

    const quantityNum = parseFloat(quantity);
    if (isNaN(quantityNum) || quantityNum < 0) {
      setError(t('portfolio.quantityInvalid', 'Ogiltigt antal'));
      return;
    }

    try {
      setError(null);
      const currency = getCurrencyForStock(
        selectedStock.ticker,
        selectedStock.companyName,
        entryExitValues
      );

      let calculatedAveragePrice: number | null = null;
      let investedAmountValue: number | null = null;
      let investmentCurrencyValue: string | null = null;

      if (investedAmount.trim()) {
        const investedAmountNum = parseFloat(investedAmount);
        if (!isNaN(investedAmountNum) && investedAmountNum > 0) {
          investedAmountValue = investedAmountNum;
          investmentCurrencyValue = investmentCurrency;
          const averagePerShare = investedAmountNum / quantityNum;
          if (investmentCurrency === 'USD') {
            calculatedAveragePrice = averagePerShare;
          } else {
            const exchangeRate = await getExchangeRate(investmentCurrency, 'USD');
            if (exchangeRate !== null) {
              calculatedAveragePrice = averagePerShare * exchangeRate;
            } else {
              calculatedAveragePrice = selectedStock.price;
              setError(t('portfolio.exchangeRateUnavailable', 'Valutakurs kunde inte hämtas. Använder nuvarande pris.'));
            }
          }
        }
      }

      if (calculatedAveragePrice === null) {
        if (currency === 'USD') {
          calculatedAveragePrice = selectedStock.price;
        } else if (selectedStock.price != null) {
          const rate = await getExchangeRate(currency, 'USD');
          if (rate !== null) {
            calculatedAveragePrice = selectedStock.price * rate;
          } else {
            calculatedAveragePrice = selectedStock.price;
            setError(t('portfolio.exchangeRateUnavailable', 'Valutakurs kunde inte hämtas. Använder nuvarande pris.'));
          }
        } else {
          calculatedAveragePrice = selectedStock.price;
        }
      }

      const brokerName = brokerSelect === BROKER_OTHER ? brokerCustom.trim() : brokerSelect;
      if (!brokerName) {
        setError(t('portfolio.brokerRequired', 'Ange broker eller välj från listan'));
        return;
      }

      const item: PortfolioItem = {
        ticker: selectedStock.ticker,
        companyName: selectedStock.companyName,
        quantity: quantityNum,
        currency,
        price: selectedStock.price,
        averagePrice: calculatedAveragePrice,
        investedAmount: investedAmountValue ?? undefined,
        investmentCurrency: investmentCurrencyValue ?? undefined,
        positions: [
          {
            broker: brokerName,
            quantity: quantityNum,
            investedAmount: investedAmountValue ?? undefined,
            investmentCurrency: investmentCurrencyValue ?? 'USD',
          },
        ],
      };

      await addPortfolioItem(currentUser.uid, item);
      await loadPortfolio();

      setSelectedStock(null);
      setSearchQuery('');
      setQuantity('');
      setInvestedAmount('');
      setInvestmentCurrency('USD');
      setBrokerSelect(DEFAULT_BROKERS[0]);
      setBrokerCustom('');
      setShowSearchResults(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add item';
      setError(errorMessage);
    }
  };

  const handleRemoveItem = async (ticker: string) => {
    if (!currentUser) return;

    try {
      await removePortfolioItem(currentUser.uid, ticker);
      await loadPortfolio();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove item';
      setError(errorMessage);
    }
  };

  const handleUpdateItem = async () => {
    if (!currentUser || !editingItem) return;

    if (editPositions.length === 0) {
      setError(t('portfolio.atLeastOnePosition', 'Minst en position krävs'));
      return;
    }
    const invalid = editPositions.some((p) => typeof p.quantity !== 'number' || p.quantity < 0);
    if (invalid) {
      setError(t('portfolio.quantityInvalid', 'Ogiltigt antal'));
      return;
    }

    try {
      setError(null);
      await updatePortfolioItem(currentUser.uid, editingItem.ticker, { positions: editPositions });
      await loadPortfolio();
      setEditingItem(null);
      setEditPositions([]);
      setEditAveragePreview(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update item';
      setError(errorMessage);
    }
  };

  const updateEditPosition = useCallback((index: number, updates: Partial<PortfolioPosition>) => {
    setEditPositions((prev) => prev.map((p, i) => (i === index ? { ...p, ...updates } : p)));
  }, []);

  const removeEditPosition = useCallback((index: number) => {
    setEditPositions((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }, []);

  const addEditPosition = useCallback(() => {
    setEditPositions((prev) => [...prev, { broker: DEFAULT_BROKERS[0], quantity: 0, investedAmount: undefined, investmentCurrency: 'USD' }]);
  }, []);

  const formatPrice = (price: number | null): string => {
    if (price === null) return '-';
    return price.toFixed(2);
  };

  const formatCurrency = (value: number, currency: string): string => {
    return `${value.toFixed(2)} ${currency}`;
  };

  const formatUSD = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '-';
    return `$${value.toFixed(2)}`;
  };

  // Transform portfolio data and compute total market value (both in USD)
  // CURRENT PRICE: lookup from benjaminGrahamData (same source as Entry/Exit Price), fallback to stored item.price
  const { transformedPortfolio, totalMarketValue, totalInvested } = useMemo(() => {
    const bgData = benjaminGrahamData ?? [];
    const withUSD = portfolio.map((item, index) => {
      const match = bgData.find(
        (bg) => bg.ticker === item.ticker && bg.companyName === item.companyName
      );
      const currentPrice = match?.price ?? item.price;
      const quantity = item.quantity;
      const averagePrice = item.averagePrice;
      const currency = getCurrencyForStock(item.ticker, item.companyName, entryExitValues);
      let currentPriceUSD: number | null = null;
      if (currentPrice !== null && currentPrice !== undefined) {
        if (currency === 'USD') {
          currentPriceUSD = currentPrice;
        } else {
          const rate = exchangeRatesByCurrency[currency];
          if (rate != null) currentPriceUSD = currentPrice * rate;
        }
      }
      return {
        ...item,
        rowNumber: index + 1,
        currentPrice,
        currentPriceUSD,
        currency,
        quantity,
        averagePrice,
      };
    });
    const total = withUSD.reduce((sum, x) => {
      if (x.currentPriceUSD != null && x.quantity > 0) return sum + x.currentPriceUSD * x.quantity;
      return sum;
    }, 0);
    const transformed: PortfolioTableItem[] = withUSD.map((x) => {
      const invested =
        x.averagePrice != null && x.averagePrice !== undefined && x.quantity > 0
          ? x.averagePrice * x.quantity
          : null;
      const marketValue =
        x.currentPriceUSD != null && x.currentPriceUSD !== undefined && x.quantity > 0
          ? x.currentPriceUSD * x.quantity
          : null;
      const profitLoss = invested != null && marketValue != null ? marketValue - invested : null;
      const profitLossPercent =
        invested != null && invested !== 0 && profitLoss != null ? (profitLoss / invested) * 100 : null;
      // Market Weight (%) = this stock's market value / total portfolio market value
      const marketWeight = total > 0 && marketValue != null ? (marketValue / total) * 100 : null;
      return {
        ...x,
        invested,
        marketValue,
        profitLoss,
        profitLossPercent,
        marketWeight,
      };
    });
    const totalInvested = transformed.reduce((sum, x) => {
      if (x.invested != null && x.invested > 0) return sum + x.invested;
      return sum;
    }, 0);
    return { transformedPortfolio: transformed, totalMarketValue: total, totalInvested };
  }, [portfolio, benjaminGrahamData, entryExitValues, exchangeRatesByCurrency]);

  const initialTableState = useMemo(() => {
    if (!link || link.viewId !== VIEW_ID || link.tableId !== TABLE_ID) return undefined;
    return {
      filterState: link.filterState ?? {},
      columnFilters: link.columnFilters ?? {},
      searchValue: link.searchValue ?? '',
      sortConfig: link.sortConfig,
    };
  }, [link]);

  useEffect(() => {
    if (initialTableState) consume();
  }, [initialTableState, consume]);

  // Row key for expand; must match getRowKey passed to BaseTable.
  // Stable identifier (ticker-companyName) so expanded state survives sort/filter changes.
  const getRowKey = useCallback((item: PortfolioTableItem) => `${item.ticker}-${item.companyName}`, []);

  // Render cell content
  const renderCell = useCallback((
    item: PortfolioTableItem,
    column: ColumnDefinition<PortfolioTableItem>,
    index: number,
    globalIndex: number,
    expandedRows?: { [key: string]: boolean },
    toggleRow?: (rowKey: string) => void
  ) => {
    const rowKey = getRowKey(item);
    const isExpanded = expandedRows?.[rowKey] ?? false;

    // Get currency from entryExitValues in real-time
    const currency = getCurrencyForStock(
      item.ticker,
      item.companyName,
      entryExitValues
    );

    switch (column.key) {
      case 'rowNumber':
        return (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                toggleRow?.(rowKey);
              }}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
              aria-label={isExpanded ? t('aria.collapseRow', 'Fäll ihop rad') : t('aria.expandRow', 'Expandera rad')}
              aria-expanded={isExpanded}
              title={isExpanded ? t('aria.collapseRow', 'Fäll ihop') : t('aria.expandRow', 'Expandera')}
            >
              <svg
                className={`w-4 h-4 text-gray-600 dark:text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <span>{globalIndex + 1}</span>
          </div>
        );
      case 'companyName':
        return <span className="font-medium">{item.companyName}</span>;
      case 'ticker':
        return <span className="text-gray-600 dark:text-gray-300">{item.ticker}</span>;
      case 'currency':
        return <span className="text-black dark:text-white">{currency}</span>;
      case 'currentPrice':
        return item.currentPrice !== null && item.currentPrice !== undefined 
          ? <span className="text-black dark:text-white">{formatPrice(item.currentPrice)}</span>
          : <span className="text-gray-500 dark:text-gray-400">-</span>;
      case 'currentPriceUSD':
        return item.currentPriceUSD !== null && item.currentPriceUSD !== undefined
          ? <span className="text-black dark:text-white">{formatUSD(item.currentPriceUSD)}</span>
          : <span className="text-gray-500 dark:text-gray-400">-</span>;
      case 'quantity':
        return <span className="text-black dark:text-white">{item.quantity}</span>;
      case 'average':
        return item.averagePrice !== null && item.averagePrice !== undefined
          ? <span className="text-black dark:text-white">{formatUSD(item.averagePrice)}</span>
          : <span className="text-gray-500 dark:text-gray-400">-</span>;
      case 'invested':
        return item.invested !== null && item.invested !== undefined
          ? <span className="text-black dark:text-white">{formatUSD(item.invested)}</span>
          : <span className="text-gray-500 dark:text-gray-400">-</span>;
      case 'marketValue':
        return item.marketValue !== null && item.marketValue !== undefined
          ? <span className="text-black dark:text-white">{formatUSD(item.marketValue)}</span>
          : <span className="text-gray-500 dark:text-gray-400">-</span>;
      case 'profitLoss':
        if (item.profitLoss === null || item.profitLoss === undefined) {
          return <span className="text-gray-500 dark:text-gray-400">-</span>;
        }
        const profitLossColor = item.profitLoss >= 0 
          ? 'text-green-600 dark:text-green-400' 
          : 'text-red-600 dark:text-red-400';
        return (
          <span className={profitLossColor}>
            {formatUSD(item.profitLoss)}
          </span>
        );
      case 'profitLossPercent':
        if (item.profitLossPercent === null || item.profitLossPercent === undefined) {
          return <span className="text-gray-500 dark:text-gray-400">-</span>;
        }
        const percentColor = item.profitLossPercent >= 0 
          ? 'text-green-600 dark:text-green-400' 
          : 'text-red-600 dark:text-red-400';
        return (
          <span className={percentColor}>
            {item.profitLossPercent.toFixed(2)}%
          </span>
        );
      case 'marketWeight':
        return item.marketWeight !== null && item.marketWeight !== undefined
          ? <span className="text-black dark:text-white">{item.marketWeight.toFixed(2)}%</span>
          : <span className="text-gray-500 dark:text-gray-400">-</span>;
      case 'actions':
        return (
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={() => {
                setEditingItem(item);
                const positions = item.positions && item.positions.length > 0
                  ? item.positions.map((p) => ({ ...p }))
                  : [{ broker: '—', quantity: item.quantity, investedAmount: item.investedAmount ?? undefined, investmentCurrency: item.investmentCurrency ?? 'USD' }];
                setEditPositions(positions);
              }}
              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 transition-colors min-h-[44px] min-w-[44px] touch-manipulation px-3 py-1 rounded"
              aria-label={t('portfolio.edit', 'Redigera')}
            >
              {t('portfolio.edit', 'Redigera')}
            </button>
            <button
              onClick={() => handleRemoveItem(item.ticker)}
              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors min-h-[44px] min-w-[44px] touch-manipulation px-3 py-1 rounded"
              aria-label={t('portfolio.remove', 'Ta bort')}
            >
              {t('portfolio.remove', 'Ta bort')}
            </button>
          </div>
        );
      default:
        return null;
    }
  }, [entryExitValues, formatPrice, formatUSD, t, handleRemoveItem, getRowKey]);

  // Expanded row: per-broker breakdown (delegated to PersonalPortfolioExpandedRow)
  const renderExpandedRow = useCallback(
    (item: PortfolioTableItem) => (
      <PersonalPortfolioExpandedRow item={item} formatCurrency={formatCurrency} />
    ),
    [formatCurrency]
  );

  // Custom header renderer with ColumnFilterMenu
  const renderHeader = useCallback((props: HeaderRenderProps<PortfolioTableItem>) => {
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
    const metadata = getColumnMetadata('personal-portfolio', column.key);
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
      return <Fragment key={column.key}>{headerContent}</Fragment>;
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
    return <Fragment key={column.key}>{headerContent}</Fragment>;
  }, []);

  if (!currentUser) {
    return (
      <div className="h-full bg-gray-100 dark:bg-gray-900 py-4 sm:py-6 lg:py-8 px-3 sm:px-4 lg:px-6 flex flex-col items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">
          {t('common.pleaseLogin', 'Please log in to view your personal portfolio')}
        </p>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-100 dark:bg-gray-900 py-4 sm:py-6 lg:py-8 px-3 sm:px-4 lg:px-6 flex flex-col transition-all duration-300 ease-in-out">
      <div className="w-full flex flex-col flex-1 min-h-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 flex-shrink-0 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-black dark:text-white mb-1 tracking-tight">
              {t('navigation.personalPortfolio', 'Personal Portfolio')}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">
              {t('portfolio.description', 'Hantera din personliga aktieportfölj')}
            </p>
          </div>
        </div>

        {loading && (
          <div className="mb-4 flex-shrink-0">
            <ProgressIndicator isLoading={true} label={t('common.loading', 'Loading...')} />
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-400 flex-shrink-0">
            {error}
          </div>
        )}

        {/* Add new item form with search */}
        <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 flex-shrink-0">
          <h2 className="text-lg font-semibold text-black dark:text-white mb-4">
            {t('portfolio.addItem', 'Lägg till aktie')}
          </h2>
          
          {/* Search field */}
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('portfolio.searchPlaceholder', 'Sök på ticker eller företagsnamn...')}
            </label>
            <div ref={searchRef} className="relative">
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedStock(null);
                  setQuantity('');
                }}
                onFocus={() => {
                  if (searchResults.length > 0 && debouncedSearchQuery.trim().length >= 2) {
                    setShowSearchResults(true);
                  }
                }}
                onKeyDown={handleKeyDown}
                placeholder={t('portfolio.searchPlaceholder', 'Sök på ticker eller företagsnamn...')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-500 rounded-md bg-white dark:bg-gray-700 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              
              {/* Search results dropdown */}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
                  {searchResults.map((result, index) => (
                    <button
                      key={`${result.ticker}-${index}`}
                      type="button"
                      onClick={() => handleSelectStock(result)}
                      className={`w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                        index === selectedIndex ? 'bg-gray-100 dark:bg-gray-700' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-black dark:text-white">
                            {result.companyName}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {result.ticker}
                          </div>
                        </div>
                        {result.price !== null && (
                          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {formatPrice(result.price)}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              {showSearchResults && debouncedSearchQuery.trim().length >= 2 && searchResults.length === 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg p-4">
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {t('portfolio.noResults', 'Inga resultat hittades')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Selected stock and quantity input */}
          {selectedStock && (
            <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
              <div className="mb-3">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('portfolio.selectStock', 'Vald aktie')}
                </div>
                <div className="text-sm text-black dark:text-white">
                  {selectedStock.companyName} ({selectedStock.ticker})
                </div>
                {selectedStock.price !== null && (
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {t('portfolio.columns.currentPrice', 'Nuvarande Pris')}: {formatPrice(selectedStock.price)}
                  </div>
                )}
              </div>

              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('portfolio.broker', 'Broker')} *
                </label>
                <select
                  value={brokerSelect}
                  onChange={(e) => setBrokerSelect(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-500 rounded-md bg-white dark:bg-gray-700 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {DEFAULT_BROKERS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                  <option value={BROKER_OTHER}>{t('portfolio.brokerOther', 'Annan')}</option>
                </select>
                {brokerSelect === BROKER_OTHER && (
                  <input
                    type="text"
                    value={brokerCustom}
                    onChange={(e) => setBrokerCustom(e.target.value)}
                    placeholder={t('portfolio.brokerCustomPlaceholder', 'Skriv brokernamn')}
                    className="mt-2 w-full px-3 py-2 border border-gray-300 dark:border-gray-500 rounded-md bg-white dark:bg-gray-700 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('portfolio.quantity', 'Antal')} *
                </label>
                <input
                  id="quantity-input"
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder={t('portfolio.quantityPlaceholder', 'Ange antal')}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-500 rounded-md bg-white dark:bg-gray-700 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && quantity.trim()) {
                      handleAddItem();
                    }
                  }}
                />
              </div>
            </div>
          )}

          {/* Investment Amount and Currency */}
          {selectedStock && (
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('portfolio.investedAmount', 'Investerat belopp')} ({t('portfolio.optional', 'Valfritt')})
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={investedAmount}
                  onChange={(e) => setInvestedAmount(e.target.value)}
                  placeholder={t('portfolio.investedAmountPlaceholder', 'T.ex. 10000')}
                  min="0"
                  step="0.01"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-500 rounded-md bg-white dark:bg-gray-700 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={investmentCurrency}
                  onChange={(e) => setInvestmentCurrency(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-500 rounded-md bg-white dark:bg-gray-700 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="USD">USD</option>
                  <option value="SEK">SEK</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="DKK">DKK</option>
                  <option value="NOK">NOK</option>
                  <option value="CHF">CHF</option>
                  <option value="AUD">AUD</option>
                  <option value="CAD">CAD</option>
                </select>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {t('portfolio.investedAmountHelp', 'Totalt investerat belopp. Om tomt används nuvarande pris.')}
              </p>
            </div>
          )}

          {/* Add button */}
          <div className="flex justify-end">
            <button
              onClick={handleAddItem}
              disabled={!selectedStock || !quantity.trim() || loading || benjaminGrahamLoading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-md transition-colors min-h-[44px] touch-manipulation"
            >
              {t('portfolio.addToPortfolio', 'Lägg till i portfölj')}
            </button>
          </div>
        </div>

        {/* Edit Modal – positions per broker */}
        {editingItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto py-8" role="dialog" aria-modal="true" aria-labelledby="edit-investment-title">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 shadow-xl my-auto">
              <h3 id="edit-investment-title" className="text-lg font-semibold text-black dark:text-white mb-2">
                {t('portfolio.editInvestment', 'Redigera investering')}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {editingItem.companyName} ({editingItem.ticker})
              </p>
              <div className="space-y-4 mb-4 max-h-[50vh] overflow-y-auto">
                {editPositions.map((pos, index) => (
                  <div key={`pos-${index}`} className="p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700/50 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 shrink-0 w-20">{t('portfolio.broker', 'Broker')}</label>
                      <input
                        type="text"
                        value={pos.broker}
                        onChange={(e) => updateEditPosition(index, { broker: e.target.value })}
                        className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-500 rounded bg-white dark:bg-gray-700 text-black dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => removeEditPosition(index)}
                        disabled={editPositions.length <= 1}
                        className="shrink-0 px-2 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label={t('portfolio.removePosition', 'Ta bort position')}
                      >
                        {t('portfolio.removePosition', 'Ta bort')}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <div className="flex items-center gap-1">
                        <label className="text-xs text-gray-600 dark:text-gray-400">{t('portfolio.quantity', 'Antal')}</label>
                        <input
                          type="number"
                          value={pos.quantity}
                          onChange={(e) => updateEditPosition(index, { quantity: parseFloat(e.target.value) || 0 })}
                          min="0"
                          step="0.01"
                          className="w-24 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-500 rounded bg-white dark:bg-gray-700 text-black dark:text-white"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <label className="text-xs text-gray-600 dark:text-gray-400">{t('portfolio.investedAmount', 'Investerat')}</label>
                        <input
                          type="number"
                          value={pos.investedAmount ?? ''}
                          onChange={(e) => updateEditPosition(index, { investedAmount: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                          min="0"
                          step="0.01"
                          placeholder="—"
                          className="w-28 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-500 rounded bg-white dark:bg-gray-700 text-black dark:text-white"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <label className="text-xs text-gray-600 dark:text-gray-400">{t('portfolio.investmentCurrency', 'Valuta')}</label>
                        <select
                          value={pos.investmentCurrency ?? 'USD'}
                          onChange={(e) => updateEditPosition(index, { investmentCurrency: e.target.value })}
                          className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-500 rounded bg-white dark:bg-gray-700 text-black dark:text-white"
                        >
                          <option value="USD">USD</option>
                          <option value="SEK">SEK</option>
                          <option value="EUR">EUR</option>
                          <option value="GBP">GBP</option>
                          <option value="DKK">DKK</option>
                          <option value="NOK">NOK</option>
                          <option value="CHF">CHF</option>
                          <option value="AUD">AUD</option>
                          <option value="CAD">CAD</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mb-4">
                <button
                  type="button"
                  onClick={addEditPosition}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {t('portfolio.addPosition', 'Lägg till position')}
                </button>
              </div>
              {editAveragePreview !== null && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium">{t('portfolio.calculatedAverage', 'Beräknat genomsnitt:')}</span>{' '}
                    {editAverageLoading ? (
                      <span className="text-gray-500 dark:text-gray-400">{t('common.loading', 'Laddar...')}</span>
                    ) : (
                      <span className="text-blue-600 dark:text-blue-400">${editAveragePreview.toFixed(2)}</span>
                    )}
                  </p>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleUpdateItem}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors min-h-[44px] touch-manipulation"
                >
                  {t('common.save', 'Spara')}
                </button>
                <button
                  onClick={() => {
                    setEditingItem(null);
                    setEditPositions([]);
                    setEditAveragePreview(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-black dark:text-white rounded-md transition-colors min-h-[44px] touch-manipulation"
                >
                  {t('common.cancel', 'Avbryt')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Summary: Total Invested and Market Value */}
        {!loading && portfolio.length > 0 && (
          <div className="mb-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 flex-shrink-0 flex flex-wrap items-center gap-6">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('portfolio.totalInvested', 'Total Invested ($)')}:
              </span>
              <span className="text-lg font-semibold text-black dark:text-white">
                {formatUSD(totalInvested)}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('portfolio.totalMarketValue', 'Market Value ($)')}:
              </span>
              <span className="text-lg font-semibold text-black dark:text-white">
                {formatUSD(totalMarketValue)}
              </span>
            </div>
          </div>
        )}

        {/* Portfolio table */}
        {loading ? (
          <div className="flex-1 min-h-0">
            <TableSkeleton rows={10} columns={7} />
          </div>
        ) : portfolio.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-400 text-lg mb-2">
                {t('portfolio.empty', 'Din portfölj är tom')}
              </p>
              <p className="text-gray-500 dark:text-gray-500 text-sm">
                {t('portfolio.emptyDescription', 'Lägg till aktier ovan för att börja bygga din portfölj')}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0">
            <BaseTable
              data={transformedPortfolio}
              loading={false}
              error={error}
              columns={PORTFOLIO_COLUMNS}
              filters={[]}
              tableId="personal-portfolio"
              initialFilterState={initialTableState?.filterState}
              initialColumnFilters={initialTableState?.columnFilters}
              initialSearchValue={initialTableState?.searchValue}
              initialSortConfig={initialTableState?.sortConfig}
              renderCell={renderCell}
              renderHeader={renderHeader}
              searchFields={['companyName', 'ticker']}
              searchPlaceholder={t('portfolio.searchPlaceholder', 'Sök på ticker eller företagsnamn...')}
              defaultSortKey="marketWeight"
              defaultSortDirection="desc"
              stickyColumns={['rowNumber', 'companyName', 'ticker', 'currency']}
              enablePagination={false}
              enableVirtualScroll={false}
              ariaLabel={t('portfolio.description', 'Personal Portfolio')}
              emptyMessage={t('portfolio.empty', 'Din portfölj är tom')}
              headerActions={({ toggleColumn, isColumnVisible }) => {
                const bothVisible = isColumnVisible('currency') && isColumnVisible('currentPrice');
                const handleToggle = () => {
                  toggleColumn('currency');
                  toggleColumn('currentPrice');
                };
                return (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleToggle}
                      className="flex items-center justify-center w-9 h-9 text-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors min-h-[44px] min-w-[44px] touch-manipulation"
                      aria-label={bothVisible ? t('portfolio.hideCurrencyAndPrice', 'Dölj valuta och nuvarande pris') : t('portfolio.showCurrencyAndPrice', 'Visa valuta och nuvarande pris')}
                      title={bothVisible ? t('portfolio.hideCurrencyAndPrice', 'Dölj valuta och nuvarande pris') : t('portfolio.showCurrencyAndPrice', 'Visa valuta och nuvarande pris')}
                    >
                      {bothVisible ? '−' : '+'}
                    </button>
                  </div>
                );
              }}
              getRowKey={getRowKey}
              renderExpandedRow={renderExpandedRow}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function PersonalPortfolioView() {
  return (
    <EntryExitProvider>
      <PersonalPortfolioViewInner />
    </EntryExitProvider>
  );
}
