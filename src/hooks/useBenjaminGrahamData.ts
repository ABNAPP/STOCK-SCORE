import { useState, useEffect, useCallback, useRef } from 'react';
import type { DataRow } from '../services/sheets';
import { transformBenjaminGrahamData as transformBenjaminGrahamFromSheet } from '../services/sheets/benjaminGrahamService';
import { 
  isDeltaSyncEnabled,
  getPollIntervalMs,
} from '../services/deltaSyncService';
import {
  getDeltaCacheEntry,
  getCachedData,
  setViewData,
  getViewDataWithFallback,
  CACHE_KEYS,
} from '../services/firestoreCacheService';
import { BenjaminGrahamData } from '../types/stock';
import { useLoadingProgress } from '../contexts/LoadingProgressContext';
import { useRefreshOptional } from '../contexts/RefreshContext';
import { usePageVisibility } from './usePageVisibility';
import { formatError, logError, createErrorHandler, isErrorType } from '../utils/errorHandler';
import { isDataRowArray } from '../utils/typeGuards';
import { logger } from '../utils/logger';
import { useNotifications } from '../contexts/NotificationContext';
import { detectDataChanges, formatChangeSummary } from '../utils/dataChangeDetector';
import { getSheetSnapshot } from '../services/sheets/sheetSnapshotService';

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || '';
const CACHE_KEY = CACHE_KEYS.BENJAMIN_GRAHAM;

function transformBenjaminGrahamData(results: { data: DataRow[]; meta: { fields: string[] | null } }): BenjaminGrahamData[] {
  if (!isDataRowArray(results.data)) {
    throw new Error('Invalid data format: expected array of DataRow');
  }
  return transformBenjaminGrahamFromSheet(results);
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

      logger.debug('Fetching Benjamin Graham snapshot', { 
        component: 'useBenjaminGrahamData', 
        operation: 'loadData',
        forceRefresh,
        isBackground 
      });

      const snapshotResult = await getSheetSnapshot('DashBoard', {
        forceRefresh,
        preferCache: !forceRefresh,
      });
      const fetchedData = transformBenjaminGrahamData({
        data: snapshotResult.data.rows,
        meta: { fields: snapshotResult.data.headers },
      });

      logger.info('Benjamin Graham data transformed from snapshot successfully', { 
        component: 'useBenjaminGrahamData', 
        operation: 'loadData',
        entryCount: fetchedData.length,
        forceRefresh,
        source: snapshotResult.source,
      });
      
      // Detect data changes
      const changes = detectDataChanges(
        previousDataRef.current,
        fetchedData,
        (item) => `${item.ticker}-${item.companyName}`,
        0.05 // 5% threshold
      );
      
      logger.debug('Updating Benjamin Graham state with new data', { 
        component: 'useBenjaminGrahamData', 
        operation: 'loadData',
        entryCount: fetchedData.length,
        hasChanges: changes.hasSignificantChanges 
      });
      
      setData(fetchedData);
      previousDataRef.current = fetchedData;
      setLastUpdated(new Date());
      currentVersionRef.current = snapshotResult.data.version ?? currentVersionRef.current;
      setViewData('entry-exit-benjamin-graham', { benjaminGraham: fetchedData }, { source: 'client-refresh' }).catch((e) =>
        logger.warn('Failed to write viewData', { component: 'useBenjaminGrahamData', error: e })
      );
      logger.info('Benjamin Graham state updated successfully', { 
        component: 'useBenjaminGrahamData', 
        operation: 'loadData',
        entryCount: fetchedData.length 
      });
      
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
      const snapshotResult = await getSheetSnapshot('DashBoard', {
        forceRefresh: true,
        preferCache: false,
      });
      const transformedData = transformBenjaminGrahamData({
        data: snapshotResult.data.rows,
        meta: { fields: snapshotResult.data.headers },
      });
      setViewData('entry-exit-benjamin-graham', { benjaminGraham: transformedData }, { source: 'client-refresh' }).catch((e) =>
        logger.warn('Failed to write viewData', { component: 'useBenjaminGrahamData', error: e })
      );
      const changes = detectDataChanges(
        previousDataRef.current,
        transformedData,
        (item) => `${item.ticker}-${item.companyName}`,
        0.05 // 5% threshold
      );

      setData(transformedData);
      previousDataRef.current = transformedData;
      currentVersionRef.current = snapshotResult.data.version ?? currentVersionRef.current;
      setLastUpdated(new Date());

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
    } catch (pollError) {
      // Silently fail polling - don't show errors to user
      const context = {
        operation: 'poll for changes',
        component: 'useBenjaminGrahamData',
        additionalInfo: { version: currentVersionRef.current },
      };
      const formatted = formatError(pollError, context);
      if (isErrorType(pollError, 'timeout')) {
        logger.warn(formatted.message, { component: context.component, operation: context.operation, ...formatted.context.additionalInfo });
      } else {
        logError(pollError, formatted.context);
      }
    }
  }, [isPageVisible]);

  // Load cache on mount - viewData first (dual-read/cutover), then appCache fallback
  useEffect(() => {
    const loadCache = async () => {
      if (cacheLoadedRef.current) return;
      cacheLoadedRef.current = true;
      
      try {
        const result = await getViewDataWithFallback<{ benjaminGraham: BenjaminGrahamData[] }>('entry-exit-benjamin-graham', {
          fallback: async () => {
            const delta = await getDeltaCacheEntry<BenjaminGrahamData[]>(CACHE_KEY);
            const regular = delta ? null : await getCachedData<BenjaminGrahamData[]>(CACHE_KEY);
            const arr = delta?.data ?? regular;
            return arr && arr.length > 0 ? { benjaminGraham: arr } : null;
          },
        });
        if (result && result.data.benjaminGraham.length > 0) {
          const cachedData = result.data.benjaminGraham;
          setData(cachedData);
          previousDataRef.current = cachedData;
          const delta = await getDeltaCacheEntry<BenjaminGrahamData[]>(CACHE_KEY);
          currentVersionRef.current = delta?.version ?? 0;
          setLoading(false);
          return;
        }
      } catch (err) {
        logger.warn('Failed to load cache, fetching fresh data', { component: 'useBenjaminGrahamData', error: err });
      }
      
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

  const refetch = useCallback(
    async (forceRefresh?: boolean | { skipFetch?: boolean }) => {
      const opts = typeof forceRefresh === 'object' ? forceRefresh : { skipFetch: false };
      if (opts?.skipFetch) {
        setLoading(true);
        try {
          const result = await getViewDataWithFallback<{ benjaminGraham: BenjaminGrahamData[] }>('entry-exit-benjamin-graham', {
            fallback: async () => {
              const delta = await getDeltaCacheEntry<BenjaminGrahamData[]>(CACHE_KEY);
              const regular = delta ? null : await getCachedData<BenjaminGrahamData[]>(CACHE_KEY);
              const arr = delta?.data ?? regular;
              return arr && arr.length > 0 ? { benjaminGraham: arr } : null;
            },
          });
          if (result?.data?.benjaminGraham?.length) {
            setData(result.data.benjaminGraham);
            previousDataRef.current = result.data.benjaminGraham;
            setLastUpdated(new Date());
          }
        } finally {
          setLoading(false);
        }
        return;
      }
      loadData(typeof forceRefresh === 'boolean' ? forceRefresh : false);
    },
    [loadData]
  );

  const refreshContext = useRefreshOptional();
  useEffect(() => {
    if (!refreshContext) return;
    const unregister = refreshContext.registerRefetch('benjamin-graham', (options) =>
      refetch(options?.skipFetch ? { skipFetch: true } : true)
    );
    return unregister;
  }, [refreshContext, refetch]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    refetch,
  };
}

