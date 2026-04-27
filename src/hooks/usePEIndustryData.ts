import { useState, useEffect, useCallback, useRef } from 'react';
import { transformPEIndustryData } from '../services/sheets/peIndustryService';
import { PEIndustryData } from '../types/stock';
import { useLoadingProgress } from '../contexts/LoadingProgressContext';
import { useRefreshOptional } from '../contexts/RefreshContext';
import {
  getCachedData,
  getDeltaCacheEntry,
  setViewData,
  getViewDataWithFallback,
  CACHE_KEYS,
} from '../services/firestoreCacheService';
import { createErrorHandler, logError, formatError, isErrorType } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { useNotifications } from '../contexts/NotificationContext';
import { detectDataChanges, formatChangeSummary } from '../utils/dataChangeDetector';
import { 
  isDeltaSyncEnabled,
  getPollIntervalMs,
} from '../services/deltaSyncService';
import { usePageVisibility } from './usePageVisibility';
import { getSheetSnapshot } from '../services/sheets/sheetSnapshotService';

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || '';
const CACHE_KEY = CACHE_KEYS.PE_INDUSTRY;

/**
 * Custom hook for fetching and managing P/E sector (ISM) sheet data with delta sync
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
 * @returns Object with data, loading state, error, lastUpdated timestamp, and refetch function
 */
export function usePEIndustryData() {
  const [data, setData] = useState<PEIndustryData[]>([]);
  const [loading, setLoading] = useState(true); // Start with loading state
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { updateProgress } = useLoadingProgress();
  const isPageVisible = usePageVisibility();
  const currentVersionRef = useRef<number>(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { createNotification } = useNotifications();
  const previousDataRef = useRef<PEIndustryData[]>([]);
  const cacheLoadedRef = useRef<boolean>(false);

  // Load data using delta-sync or fallback to regular fetch
  const loadData = useCallback(async (forceRefresh: boolean = false, isBackground: boolean = false) => {
    try {
      if (!isBackground) {
        setLoading(true);
      }
      setError(null);
      
      if (!isBackground) {
        updateProgress('pe-industry', {
          status: 'loading',
          progress: 0,
          message: 'Loading data...',
        });
      }

      logger.debug('Fetching P/E sector (ISM) snapshot', { 
        component: 'usePEIndustryData', 
        operation: 'loadData',
        forceRefresh,
        isBackground 
      });

      const snapshotResult = await getSheetSnapshot('DashBoard', {
        forceRefresh,
        preferCache: !forceRefresh,
      });
      const fetchedData = transformPEIndustryData({
        data: snapshotResult.data.rows,
        meta: { fields: snapshotResult.data.headers },
      });

      logger.info('P/E sector (ISM) data transformed from snapshot successfully', { 
        component: 'usePEIndustryData', 
        operation: 'loadData',
        entryCount: fetchedData.length,
        forceRefresh,
        source: snapshotResult.source,
      });
      
      // Detect data changes
      const changes = detectDataChanges(
        previousDataRef.current,
        fetchedData,
        (item) => item.industry,
        0.05 // 5% threshold
      );
      
      logger.debug('Updating P/E sector (ISM) state with new data', { 
        component: 'usePEIndustryData', 
        operation: 'loadData',
        entryCount: fetchedData.length,
        hasChanges: changes.hasSignificantChanges 
      });
      
      setData(fetchedData);
      previousDataRef.current = fetchedData;
      setLastUpdated(new Date());
      currentVersionRef.current = snapshotResult.data.version ?? currentVersionRef.current;
      setViewData('fundamental-pe-industry', { peIndustry: fetchedData }, { source: 'client-refresh' }).catch((e) =>
        logger.warn('Failed to write viewData', { component: 'usePEIndustryData', error: e })
      );
      logger.info('P/E sector (ISM) state updated successfully', { 
        component: 'usePEIndustryData', 
        operation: 'loadData',
        entryCount: fetchedData.length 
      });
      
      // Show notification if significant changes detected
      if (changes.hasSignificantChanges && !isBackground) {
        const changeMessage = formatChangeSummary(changes);
        createNotification(
          'data-update',
          'P/E SECTOR (ISM) Data Updated',
          `Total: ${changes.total} items. ${changeMessage}`,
          {
            showDesktop: true,
            data: { changes, dataType: 'pe-industry' },
          }
        );
      }
      
      if (!isBackground) {
        updateProgress('pe-industry', {
          status: 'complete',
          progress: 100,
        });
      }
    } catch (err: unknown) {
      const errorHandler = createErrorHandler({
        operation: 'fetch P/E sector (ISM) sheet data',
        component: 'usePEIndustryData',
        additionalInfo: { forceRefresh, isBackground },
      });
      const formatted = errorHandler(err);
      setError(formatted.userMessage);
      if (!isBackground) {
        updateProgress('pe-industry', {
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
      const transformedData = transformPEIndustryData({
        data: snapshotResult.data.rows,
        meta: { fields: snapshotResult.data.headers },
      });
      setViewData('fundamental-pe-industry', { peIndustry: transformedData }, { source: 'client-refresh' }).catch((e) =>
        logger.warn('Failed to write viewData', { component: 'usePEIndustryData', error: e })
      );
      const dataChanges = detectDataChanges(
        previousDataRef.current,
        transformedData,
        (item) => item.industry,
        0.05 // 5% threshold
      );

      setData(transformedData);
      previousDataRef.current = transformedData;
      currentVersionRef.current = snapshotResult.data.version ?? currentVersionRef.current;
      setLastUpdated(new Date());

      if (dataChanges.hasSignificantChanges) {
        const changeMessage = formatChangeSummary(dataChanges);
        createNotification(
          'data-update',
          'P/E SECTOR (ISM) Data Updated',
          `Total: ${dataChanges.total} items. ${changeMessage}`,
          {
            showDesktop: true,
            data: { changes: dataChanges, dataType: 'pe-industry' },
          }
        );
      }
    } catch (pollError) {
      // Silently fail polling - don't show errors to user
      const context = {
        operation: 'poll for changes',
        component: 'usePEIndustryData',
        additionalInfo: { version: currentVersionRef.current },
      };
      const formatted = formatError(pollError, context);
      if (isErrorType(pollError, 'timeout')) {
        logger.warn(formatted.message, { component: context.component, operation: context.operation, ...formatted.context.additionalInfo });
      } else {
        logError(pollError, formatted.context);
      }
    }
  }, [isPageVisible, createNotification]);

  // Load cache on mount - viewData first (dual-read/cutover), then appCache fallback
  useEffect(() => {
    const loadCache = async () => {
      if (cacheLoadedRef.current) return;
      cacheLoadedRef.current = true;
      
      try {
        const result = await getViewDataWithFallback<{ peIndustry: PEIndustryData[] }>('fundamental-pe-industry', {
          fallback: async () => {
            const delta = await getDeltaCacheEntry<PEIndustryData[]>(CACHE_KEY);
            const regular = delta ? null : await getCachedData<PEIndustryData[]>(CACHE_KEY);
            const arr = delta?.data ?? regular;
            return arr && arr.length > 0 ? { peIndustry: arr } : null;
          },
        });
        if (result && result.data.peIndustry.length > 0) {
          const cachedData = result.data.peIndustry;
          setData(cachedData);
          previousDataRef.current = cachedData;
          const delta = await getDeltaCacheEntry<PEIndustryData[]>(CACHE_KEY);
          currentVersionRef.current = delta?.version ?? 0;
          setLoading(false);
          return;
        }
      } catch (err) {
        logger.warn('Failed to load cache, fetching fresh data', { component: 'usePEIndustryData', error: err });
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
          const result = await getViewDataWithFallback<{ peIndustry: PEIndustryData[] }>('fundamental-pe-industry', {
            fallback: async () => {
              const delta = await getDeltaCacheEntry<PEIndustryData[]>(CACHE_KEY);
              const regular = delta ? null : await getCachedData<PEIndustryData[]>(CACHE_KEY);
              const arr = delta?.data ?? regular;
              return arr && arr.length > 0 ? { peIndustry: arr } : null;
            },
          });
          if (result?.data?.peIndustry?.length) {
            setData(result.data.peIndustry);
            previousDataRef.current = result.data.peIndustry;
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
    const unregister = refreshContext.registerRefetch('pe-industry', (options) =>
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

