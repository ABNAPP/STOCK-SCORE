import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  fetchBenjaminGrahamData, 
  ProgressCallback,
  getValue,
  isValidValue,
  parseNumericValueNullable
} from '../services/sheets';
import type { DataRow } from '../services/sheets';
import { 
  initSync, 
  pollChanges, 
  loadSnapshot, 
  applyChangesToCache,
  isDeltaSyncEnabled,
  getPollIntervalMs,
  snapshotToTransformerFormat,
  type DeltaSyncConfig
} from '../services/deltaSyncService';
import { setDeltaCacheEntry, getDeltaCacheEntry, getCachedData, CACHE_KEYS } from '../services/firestoreCacheService';
import { BenjaminGrahamData } from '../types/stock';
import { useLoadingProgress } from '../contexts/LoadingProgressContext';
import { usePageVisibility } from './usePageVisibility';
import { formatError, logError, createErrorHandler } from '../utils/errorHandler';
import { isDataRowArray } from '../utils/typeGuards';
import { logger } from '../utils/logger';
import { useNotifications } from '../contexts/NotificationContext';
import { detectDataChanges, formatChangeSummary } from '../utils/dataChangeDetector';

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || '';
const SHEET_NAME = 'DashBoard';
const CACHE_KEY = CACHE_KEYS.BENJAMIN_GRAHAM;

// Transformer function for Benjamin Graham data
function transformBenjaminGrahamData(results: { data: DataRow[]; meta: { fields: string[] | null } }): BenjaminGrahamData[] {
  if (!isDataRowArray(results.data)) {
    const errorHandler = createErrorHandler({
      operation: 'transform Benjamin Graham data',
      component: 'useBenjaminGrahamData',
    });
    throw new Error('Invalid data format: expected array of DataRow');
  }
  
  const benjaminGrahamData = results.data
    .map((row: DataRow) => {
      const companyName = getValue(['Company Name', 'Company', 'company'], row);
      const ticker = getValue(['Ticker', 'ticker', 'Ticket', 'ticket', 'Symbol', 'symbol'], row);
      const priceStr = getValue(['Price', 'price', 'PRICE'], row);
      const benjaminGrahamStr = getValue(['Benjamin Graham', 'benjamin graham', 'Benjamin', 'benjamin'], row);
      
      // Only process if company name is valid (not #N/A)
      if (!isValidValue(companyName)) {
        return null;
      }
      
      // Filter out rows where Ticker is N/A (DashBoard rule: if Ticker is N/A, don't fetch data)
      if (!isValidValue(ticker)) {
        return null;
      }
      
      // Parse Price value as number (handle #N/A)
      const price = parseNumericValueNullable(priceStr);
      
      // Parse Benjamin Graham value as number (handle #N/A)
      const benjaminGraham = parseNumericValueNullable(benjaminGrahamStr);
      
      // Parse IV (FCF) if it exists
      const ivFcfStr = getValue(['IV (FCF)', 'IV(FCF)', 'iv fcf', 'ivfcf'], row);
      const ivFcf = parseNumericValueNullable(ivFcfStr);
      
      // Parse IRR1 if it exists
      const irr1Str = getValue(['IRR1', 'irr1', 'IRR 1', 'irr 1'], row);
      const irr1 = parseNumericValueNullable(irr1Str);
      
      // Include row if both company name and ticker are valid (we already checked above)
      return {
        companyName: companyName,
        ticker: ticker,
        price: price,
        benjaminGraham: benjaminGraham,
        ivFcf: ivFcf, // Include if it exists
        irr1: irr1, // Include if it exists
      };
    })
    .filter((data) => data !== null) as BenjaminGrahamData[];
  
  return benjaminGrahamData;
}

/**
 * Custom hook for fetching and managing Benjamin Graham data with delta sync
 * 
 * Implements delta sync for efficient data updates:
 * - **Delta Sync (enabled)**: Uses version-based incremental updates
 *   - Initial load: Full snapshot
 *   - Subsequent updates: Only changed rows (polling every 15 minutes)
 *   - Automatic polling when page is visible
 * - **Fallback (disabled)**: Uses regular fetch with stale-while-revalidate
 * 
 * **Delta Sync Strategy:**
 * - Polls for changes every 15 minutes (configurable)
 * - Only polls when page is visible (saves resources)
 * - Falls back to regular fetch if delta sync fails
 * - Uses version numbers to track changes efficiently
 * 
 * **Cache Strategy:**
 * - Delta cache: Version-based with lastUpdated timestamp
 * - Regular cache: TTL-based (20 minutes)
 * - Shows cached data immediately, updates in background
 * 
 * **Edge Cases:**
 * - Missing threshold data: Returns BLANK for industry-dependent metrics
 * - Version mismatch: Triggers full snapshot reload
 * - Polling failures: Silent (doesn't show errors to user)
 * 
 * @returns Object with data, loading state, error, lastUpdated timestamp, and refetch function
 * 
 * @example
 * ```typescript
 * const { data, loading, error, refetch } = useBenjaminGrahamData();
 * 
 * // Data automatically updates via delta sync if enabled
 * // Or manually refresh:
 * refetch(true);
 * ```
 */
export function useBenjaminGrahamData() {
  const [data, setData] = useState<BenjaminGrahamData[]>([]);
  const [loading, setLoading] = useState(true); // Start with loading state
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { updateProgress } = useLoadingProgress();
  const isPageVisible = usePageVisibility();
  const currentVersionRef = useRef<number>(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { createNotification } = useNotifications();
  const previousDataRef = useRef<BenjaminGrahamData[]>([]);
  const cacheLoadedRef = useRef<boolean>(false);

  // Load data using delta-sync or fallback to regular fetch
  const loadData = useCallback(async (forceRefresh: boolean = false, isBackground: boolean = false) => {
    try {
      if (!isBackground) {
        setLoading(true);
      }
      setError(null);
      
      if (!isBackground) {
        updateProgress('benjamin-graham', {
          status: 'loading',
          progress: 0,
          message: 'Loading data...',
        });
      }

      // Try delta-sync if enabled
      if (isDeltaSyncEnabled() && APPS_SCRIPT_URL && !forceRefresh) {
        try {
          const config: DeltaSyncConfig = {
            sheetName: SHEET_NAME,
            apiBaseUrl: APPS_SCRIPT_URL,
          };

          // Load initial snapshot or use cached data
          const result = await initSync<BenjaminGrahamData>(
            config,
            CACHE_KEY,
            transformBenjaminGrahamData
          );

          // Detect data changes
          const changes = detectDataChanges(
            previousDataRef.current,
            result.data,
            (item) => `${item.ticker}-${item.companyName}`,
            0.05 // 5% threshold
          );
          
          setData(result.data);
          previousDataRef.current = result.data;
          currentVersionRef.current = result.version;
          setLastUpdated(new Date());
          
          // Show notification if significant changes detected
          if (changes.hasSignificantChanges && !isBackground) {
            const changeMessage = formatChangeSummary(changes);
            createNotification(
              'data-update',
              'Benjamin Graham Data Updated',
              `Total: ${changes.total} items. ${changeMessage}`,
              {
                showDesktop: true,
                data: { changes, dataType: 'benjamin-graham' },
              }
            );
          }
          
          if (!isBackground) {
            updateProgress('benjamin-graham', {
              status: 'complete',
              progress: 100,
              message: 'Data loaded',
            });
          }
          
          if (!isBackground) {
            setLoading(false);
          }
          return;
        } catch (deltaSyncError) {
          // Delta sync failed, fallback to regular fetch
          const errorMessage = deltaSyncError instanceof Error ? deltaSyncError.message : String(deltaSyncError);
          
          // Only log warning if it's not a timeout (timeouts are expected and will fallback)
          if (!errorMessage.includes('timeout') && !errorMessage.includes('Request timeout')) {
            logger.warn(
              `Delta sync failed for ${SHEET_NAME}, falling back to regular fetch: ${errorMessage}`,
              { component: 'useBenjaminGrahamData', operation: 'initialize delta sync', sheetName: SHEET_NAME, error: deltaSyncError }
            );
          } else {
            logger.debug(
              `Delta sync timed out for ${SHEET_NAME}, using regular fetch instead`,
              { component: 'useBenjaminGrahamData', operation: 'initialize delta sync', sheetName: SHEET_NAME }
            );
          }
          // Don't throw - fallback to regular fetch
        }
      }

      // Fallback to regular fetch
      const progressCallback: ProgressCallback = (progress) => {
        if (!isBackground) {
          updateProgress('benjamin-graham', {
            progress: progress.percentage,
            status: progress.stage === 'complete' ? 'complete' : 'loading',
            message: progress.message,
            rowsLoaded: progress.rowsProcessed,
            totalRows: progress.totalRows,
          });
        }
      };
      
      const fetchedData = await fetchBenjaminGrahamData(forceRefresh, progressCallback);
      
      // Detect data changes
      const changes = detectDataChanges(
        previousDataRef.current,
        fetchedData,
        (item) => `${item.ticker}-${item.companyName}`,
        0.05 // 5% threshold
      );
      
      setData(fetchedData);
      previousDataRef.current = fetchedData;
      setLastUpdated(new Date());
      
      // Show notification if significant changes detected
      if (changes.hasSignificantChanges && !isBackground) {
        const changeMessage = formatChangeSummary(changes);
        createNotification(
          'data-update',
          'Benjamin Graham Data Updated',
          `Total: ${changes.total} items. ${changeMessage}`,
          {
            showDesktop: true,
            data: { changes, dataType: 'benjamin-graham' },
          }
        );
      }
      
      if (!isBackground) {
        updateProgress('benjamin-graham', {
          status: 'complete',
          progress: 100,
        });
      }
    } catch (err: unknown) {
      const errorHandler = createErrorHandler({
        operation: 'fetch Benjamin Graham data',
        component: 'useBenjaminGrahamData',
        additionalInfo: { forceRefresh, isBackground },
      });
      const formatted = errorHandler(err);
      setError(formatted.userMessage);
      if (!isBackground) {
        updateProgress('benjamin-graham', {
          status: 'error',
          progress: 0,
          message: formatted.userMessage,
        });
      }
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  }, [updateProgress, createNotification]);

  // Poll for changes using delta-sync
  const pollForChanges = useCallback(async () => {
    // Only poll if page is visible
    if (!isPageVisible) {
      return;
    }

    if (!isDeltaSyncEnabled() || !APPS_SCRIPT_URL || currentVersionRef.current === 0) {
      return;
    }

    try {
      const config: DeltaSyncConfig = {
        sheetName: SHEET_NAME,
        apiBaseUrl: APPS_SCRIPT_URL,
      };

      const changes = await pollChanges(config, currentVersionRef.current);
      const cacheResult = applyChangesToCache<BenjaminGrahamData>(changes, CACHE_KEY);

      if (cacheResult.needsReload) {
        // Changes detected, reload snapshot
        const snapshot = await loadSnapshot(config);
        const transformerFormat = snapshotToTransformerFormat(snapshot);
        const transformedData = transformBenjaminGrahamData(transformerFormat);
        setDeltaCacheEntry(CACHE_KEY, transformedData, snapshot.version, true);
        
        // Detect data changes
        const changes = detectDataChanges(
          previousDataRef.current,
          transformedData,
          (item) => `${item.ticker}-${item.companyName}`,
          0.05 // 5% threshold
        );
        
        setData(transformedData);
        previousDataRef.current = transformedData;
        currentVersionRef.current = snapshot.version;
        setLastUpdated(new Date());
        
        // Show notification if significant changes detected
        if (changes.hasSignificantChanges) {
          const changeMessage = formatChangeSummary(changes);
          createNotification(
            'data-update',
            'Benjamin Graham Data Updated',
            `Total: ${changes.total} items. ${changeMessage}`,
            {
              showDesktop: true,
              data: { changes, dataType: 'benjamin-graham' },
            }
          );
        }
      } else if (cacheResult.data) {
        // No changes, use cached data
        setData(cacheResult.data);
        currentVersionRef.current = cacheResult.version;
      }
    } catch (pollError) {
      // Silently fail polling - don't show errors to user
      const errorHandler = createErrorHandler({
        operation: 'poll for changes',
        component: 'useBenjaminGrahamData',
        additionalInfo: { version: currentVersionRef.current },
      });
      logError(pollError, errorHandler({}).context);
      // Don't set error state - polling failures should be silent
    }
  }, [isPageVisible]);

  // Load cache on mount - check Firestore cache first
  useEffect(() => {
    const loadCache = async () => {
      if (cacheLoadedRef.current) return;
      cacheLoadedRef.current = true;
      
      try {
        // Try delta cache first, then fallback to regular cache
        const deltaCacheEntry = await getDeltaCacheEntry<BenjaminGrahamData[]>(CACHE_KEY);
        const regularCache = deltaCacheEntry ? null : await getCachedData<BenjaminGrahamData[]>(CACHE_KEY);
        const cachedData = deltaCacheEntry?.data || regularCache;
        
        if (cachedData && cachedData.length > 0) {
          setData(cachedData);
          previousDataRef.current = cachedData;
          currentVersionRef.current = deltaCacheEntry?.version || 0;
          setLoading(false);
          // Don't fetch if we have valid cache - hard cache, no background updates
          return;
        }
        // No cache, fetch fresh data
      } catch (err) {
        // If cache load fails, log and continue to fetch fresh data
        logger.warn('Failed to load cache, fetching fresh data', { 
          component: 'useBenjaminGrahamData', 
          error: err 
        });
      }
      
      // If no cache or cache load failed, fetch fresh data
      loadData(false, false);
    };
    
    loadCache();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Set up polling for changes (delta-sync only)
  useEffect(() => {
    if (isDeltaSyncEnabled() && APPS_SCRIPT_URL && isPageVisible) {
      const intervalMs = getPollIntervalMs();
      
      // Poll immediately after initial load (with delay)
      const initialPollTimeout = setTimeout(() => {
        pollForChanges();
      }, 5000); // Wait 5 seconds after initial load

      // Set up periodic polling (only when page is visible)
      pollIntervalRef.current = setInterval(() => {
        pollForChanges();
      }, intervalMs);

      return () => {
        clearTimeout(initialPollTimeout);
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      };
    } else {
      // Clear interval if page becomes hidden or delta-sync is disabled
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }
  }, [pollForChanges, isPageVisible]);

  const refetch = useCallback((forceRefresh?: boolean) => {
    loadData(forceRefresh ?? false);
  }, [loadData]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    refetch,
  };
}

