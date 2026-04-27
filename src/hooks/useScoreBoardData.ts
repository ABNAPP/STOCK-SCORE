import { useState, useEffect, useCallback, useRef } from 'react';
import { createScoreBoardTransformer, type SMADataMapEntry } from '../services/sheets/scoreBoardService';
import { transformPEIndustryData } from '../services/sheets/peIndustryService';
import { transformSMAData } from '../services/sheets/smaService';
import { ScoreBoardData, PEIndustryData } from '../types/stock';
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
import { useNotifications } from '../contexts/NotificationContext';
import { detectDataChanges, formatChangeSummary } from '../utils/dataChangeDetector';
import { logger } from '../utils/logger';
import { 
  isDeltaSyncEnabled,
  getPollIntervalMs,
} from '../services/deltaSyncService';
import { usePageVisibility } from './usePageVisibility';
import { useTranslation } from 'react-i18next';
import { getSheetSnapshot } from '../services/sheets/sheetSnapshotService';

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || '';
const CACHE_KEY = CACHE_KEYS.SCORE_BOARD;

/**
 * Custom hook for fetching and managing Score Board data with delta sync
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
 * - Fetches P/E sector (ISM) sheet and SMA data separately for calculations
 * 
 * **Cache Strategy:**
 * - Delta cache: Version-based with lastUpdated timestamp
 * - Regular cache: TTL-based (20 minutes)
 * - Shows cached data immediately, updates in background
 * 
 * @returns Object with data, loading state, error, lastUpdated timestamp, and refetch function
 * 
 * @example
 * ```typescript
 * const { data, loading, error, refetch } = useScoreBoardData();
 * 
 * // Data automatically updates via delta sync if enabled
 * // Or manually refresh:
 * refetch(true);
 * ```
 */
const OFFLINE_ERROR_KEY = 'offline.dataUnavailable';

type DataSource = 'viewData' | 'appCache' | 'network';

export function useScoreBoardData() {
  const [data, setData] = useState<ScoreBoardData[]>([]);
  const [loading, setLoading] = useState(true); // Start with loading state
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [dataSource, setDataSource] = useState<DataSource | null>(null);
  const { updateProgress } = useLoadingProgress();
  const isPageVisible = usePageVisibility();
  const { t } = useTranslation();
  const currentVersionRef = useRef<number>(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { createNotification } = useNotifications();
  const previousDataRef = useRef<ScoreBoardData[]>([]);
  const cacheLoadedRef = useRef<boolean>(false);

  // Helper function to fetch P/E sector (ISM) sheet and SMA data and create maps
  const fetchDependenciesAndCreateTransformer = useCallback(async (forceRefresh: boolean = false) => {
    // Fetch DashBoard and SMA snapshots in parallel (they are independent)
    const [dashboardSnapshotResult, smaSnapshotResult] = await Promise.allSettled([
      getSheetSnapshot('DashBoard', {
        forceRefresh,
        preferCache: !forceRefresh,
      }),
      getSheetSnapshot('SMA', {
        forceRefresh,
        preferCache: !forceRefresh,
      }),
    ]);

    // Process PEIndustryData from DashBoard snapshot
    let peIndustryData: PEIndustryData[] = [];
    if (dashboardSnapshotResult.status === 'fulfilled') {
      peIndustryData = transformPEIndustryData({
        data: dashboardSnapshotResult.value.data.rows,
        meta: { fields: dashboardSnapshotResult.value.data.headers },
      });
    } else {
      logger.warn(
        'Failed to load DashBoard snapshot for P/E1/P/E2 median calculation',
        { component: 'useScoreBoardData', operation: 'fetchDependenciesAndCreateTransformer', error: dashboardSnapshotResult.reason }
      );
    }

    // Create maps for quick lookup: industry -> pe1 and pe2 (median)
    const industryPe1Map = new Map<string, number>();
    const industryPe2Map = new Map<string, number>();
    peIndustryData.forEach((peIndustry) => {
      if (peIndustry.pe1 !== null) {
        industryPe1Map.set(peIndustry.industry.toLowerCase(), peIndustry.pe1);
      }
      if (peIndustry.pe2 !== null) {
        industryPe2Map.set(peIndustry.industry.toLowerCase(), peIndustry.pe2);
      }
    });

    // Process SMAData results from SMA snapshot (SMA colors computed in view from price vs SMA values)
    let smaDataMap = new Map<string, SMADataMapEntry>();
    if (smaSnapshotResult.status === 'fulfilled') {
      const smaData = transformSMAData({
        data: smaSnapshotResult.value.data.rows,
        meta: { fields: smaSnapshotResult.value.data.headers },
      });
      smaData.forEach((sma) => {
        const tickerKey = sma.ticker.toLowerCase().trim();
        smaDataMap.set(tickerKey, { sma9: sma.sma9, sma21: sma.sma21, sma55: sma.sma55, sma200: sma.sma200 });
      });
    } else {
      logger.warn(
        'Failed to load SMA snapshot for Score Board',
        { component: 'useScoreBoardData', operation: 'fetchDependenciesAndCreateTransformer', error: smaSnapshotResult.reason }
      );
    }

    // Create transformer with the maps
    const transformer = createScoreBoardTransformer(industryPe1Map, industryPe2Map, smaDataMap);

    // Convert Maps to plain objects for worker serialization (delta sync / initSync)
    const industryPe1MapObj: Record<string, number> = {};
    industryPe1Map.forEach((value, key) => {
      industryPe1MapObj[key] = value;
    });
    const industryPe2MapObj: Record<string, number> = {};
    industryPe2Map.forEach((value, key) => {
      industryPe2MapObj[key] = value;
    });
    const smaDataMapObj: Record<string, SMADataMapEntry> = {};
    smaDataMap.forEach((value, key) => {
      smaDataMapObj[key] = value;
    });

    return {
      transformer,
      additionalData: {
        industryPe1Map: industryPe1MapObj,
        industryPe2Map: industryPe2MapObj,
        smaDataMap: smaDataMapObj,
      },
    };
  }, []);

  // Load data from central snapshots and transform into Score Board rows
  const loadData = useCallback(async (forceRefresh: boolean = false, isBackground: boolean = false) => {
    try {
      if (!isBackground) {
        setLoading(true);
      }
      setError(null);

      // Fail fast when offline: try cache first, otherwise set error immediately
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const fallbackFn = async () => {
          const delta = await getDeltaCacheEntry<ScoreBoardData[]>(CACHE_KEY);
          const regular = delta ? null : await getCachedData<ScoreBoardData[]>(CACHE_KEY);
          const arr = delta?.data ?? regular;
          return arr && arr.length > 0 ? { scoreBoard: arr } : null;
        };
        let result = await getViewDataWithFallback<{ scoreBoard: ScoreBoardData[] }>('score-board', { fallback: fallbackFn });
        if (!result) {
          result = await getViewDataWithFallback<{ scoreBoard: ScoreBoardData[] }>('score', { fallback: fallbackFn });
        }
        if (result?.data?.scoreBoard?.length) {
          setData(result.data.scoreBoard);
          previousDataRef.current = result.data.scoreBoard;
          setLastUpdated(result.timestamp ? new Date(result.timestamp) : new Date());
          setDataSource(result.source);
        } else {
          setError(t(OFFLINE_ERROR_KEY));
        }
        if (!isBackground) setLoading(false);
        return;
      }
      
      if (!isBackground) {
        updateProgress('score-board', {
          status: 'loading',
          progress: 0,
          message: 'Loading data...',
        });
      }

      logger.debug('Fetching Score Board snapshots', { 
        component: 'useScoreBoardData', 
        operation: 'loadData',
        forceRefresh,
        isBackground 
      });

      // Build transformer from snapshot-derived dependencies
      const { transformer } = await fetchDependenciesAndCreateTransformer(forceRefresh);
      // Use DashBoard snapshot as base dataset for Score Board transformation
      const dashboardSnapshot = await getSheetSnapshot('DashBoard', {
        forceRefresh,
        preferCache: !forceRefresh,
      });
      const fetchedData = transformer({
        data: dashboardSnapshot.data.rows,
        meta: { fields: dashboardSnapshot.data.headers },
      });

      logger.info('Score Board data transformed from snapshots successfully', { 
        component: 'useScoreBoardData', 
        operation: 'loadData',
        entryCount: fetchedData.length,
        forceRefresh,
        source: dashboardSnapshot.source,
      });
      
      // Detect data changes
      const changes = detectDataChanges(
        previousDataRef.current,
        fetchedData,
        (item) => `${item.ticker}-${item.companyName}`,
        0.05 // 5% threshold
      );
      
      // Update data
      logger.debug('Updating Score Board state with new data', { 
        component: 'useScoreBoardData', 
        operation: 'loadData',
        entryCount: fetchedData.length,
        hasChanges: changes.hasSignificantChanges 
      });
      
      setData(fetchedData);
      previousDataRef.current = fetchedData;
      setLastUpdated(new Date());
      setDataSource('network');
      currentVersionRef.current = dashboardSnapshot.data.version ?? currentVersionRef.current;
      setViewData('score-board', { scoreBoard: fetchedData }, { source: 'client-refresh' }).catch((e) =>
        logger.warn('Failed to write viewData', { component: 'useScoreBoardData', error: e })
      );
      setViewData('score', { scoreBoard: fetchedData }, { source: 'client-refresh' }).catch((e) =>
        logger.warn('Failed to write viewData', { component: 'useScoreBoardData', error: e })
      );
      logger.info('Score Board state updated successfully', { 
        component: 'useScoreBoardData', 
        operation: 'loadData',
        entryCount: fetchedData.length 
      });
      
      // Show notification if significant changes detected
      if (changes.hasSignificantChanges && !isBackground) {
        const changeMessage = formatChangeSummary(changes);
        createNotification(
          'data-update',
          'Score Board Data Updated',
          `Total: ${changes.total} items. ${changeMessage}`,
          {
            showDesktop: true,
            data: { changes, dataType: 'score-board' },
          }
        );
      }
      
      if (!isBackground) {
        updateProgress('score-board', {
          status: 'complete',
          progress: 100,
        });
      }
    } catch (err: unknown) {
      // Fail fast: when offline, show offline message instead of generic error
      let errorMessage: string;
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        errorMessage = t(OFFLINE_ERROR_KEY);
        setError(errorMessage);
      } else {
        const errorHandler = createErrorHandler({
          operation: 'fetch Score Board data',
          component: 'useScoreBoardData',
          additionalInfo: { forceRefresh, isBackground },
        });
        const formatted = errorHandler(err);
        errorMessage = formatted.userMessage;
        setError(errorMessage);
      }
      if (!isBackground) {
        updateProgress('score-board', {
          status: 'error',
          progress: 0,
          message: errorMessage,
        });
      }
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  }, [updateProgress, createNotification, fetchDependenciesAndCreateTransformer, t]);

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
      // Minimal-risk polling update: force-refresh central snapshots and re-transform
      const { transformer } = await fetchDependenciesAndCreateTransformer(true);
      const dashboardSnapshot = await getSheetSnapshot('DashBoard', {
        forceRefresh: true,
        preferCache: false,
      });
      const transformedData = transformer({
        data: dashboardSnapshot.data.rows,
        meta: { fields: dashboardSnapshot.data.headers },
      });
      setViewData('score-board', { scoreBoard: transformedData }, { source: 'client-refresh' }).catch((e) =>
        logger.warn('Failed to write viewData', { component: 'useScoreBoardData', error: e })
      );
      setViewData('score', { scoreBoard: transformedData }, { source: 'client-refresh' }).catch((e) =>
        logger.warn('Failed to write viewData', { component: 'useScoreBoardData', error: e })
      );
      const dataChanges = detectDataChanges(
        previousDataRef.current,
        transformedData,
        (item) => `${item.ticker}-${item.companyName}`,
        0.05 // 5% threshold
      );

      setData(transformedData);
      previousDataRef.current = transformedData;
      currentVersionRef.current = dashboardSnapshot.data.version ?? currentVersionRef.current;
      setLastUpdated(new Date());

      if (dataChanges.hasSignificantChanges) {
        const changeMessage = formatChangeSummary(dataChanges);
        createNotification(
          'data-update',
          'Score Board Data Updated',
          `Total: ${dataChanges.total} items. ${changeMessage}`,
          {
            showDesktop: true,
            data: { changes: dataChanges, dataType: 'score-board' },
          }
        );
      }
    } catch (pollError) {
      // Silently fail polling - don't show errors to user
      const context = {
        operation: 'poll for changes',
        component: 'useScoreBoardData',
        additionalInfo: { version: currentVersionRef.current },
      };
      const formatted = formatError(pollError, context);
      // Timeouts during poll are expected (e.g. cold start); log as warning to avoid noisy [ERROR]
      if (isErrorType(pollError, 'timeout')) {
        logger.warn(formatted.message, { component: context.component, operation: context.operation, ...formatted.context.additionalInfo });
      } else {
        logError(pollError, formatted.context);
      }
    }
  }, [isPageVisible, createNotification, fetchDependenciesAndCreateTransformer]);

  // Load cache on mount - viewData first (dual-read/cutover), then appCache fallback
  useEffect(() => {
    const loadCache = async () => {
      if (cacheLoadedRef.current) return;
      cacheLoadedRef.current = true;
      
      try {
        const fallbackFn = async () => {
          const delta = await getDeltaCacheEntry<ScoreBoardData[]>(CACHE_KEY);
          const regular = delta ? null : await getCachedData<ScoreBoardData[]>(CACHE_KEY);
          const arr = delta?.data ?? regular;
          return arr && arr.length > 0 ? { scoreBoard: arr } : null;
        };
        let result = await getViewDataWithFallback<{ scoreBoard: ScoreBoardData[] }>('score-board', { fallback: fallbackFn });
        if (!result) {
          result = await getViewDataWithFallback<{ scoreBoard: ScoreBoardData[] }>('score', { fallback: fallbackFn });
        }
        if (result && result.data.scoreBoard.length > 0) {
          const cachedData = result.data.scoreBoard;
          setData(cachedData);
          previousDataRef.current = cachedData;
          setLastUpdated(result.timestamp ? new Date(result.timestamp) : null);
          setDataSource(result.source);
          const delta = await getDeltaCacheEntry<ScoreBoardData[]>(CACHE_KEY);
          currentVersionRef.current = delta?.version ?? 0;
          setLoading(false);
          return;
        }
      } catch (err) {
        logger.warn('Failed to load cache, fetching fresh data', { component: 'useScoreBoardData', error: err });
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
          const fallbackFn = async () => {
            const delta = await getDeltaCacheEntry<ScoreBoardData[]>(CACHE_KEY);
            const regular = delta ? null : await getCachedData<ScoreBoardData[]>(CACHE_KEY);
            const arr = delta?.data ?? regular;
            return arr && arr.length > 0 ? { scoreBoard: arr } : null;
          };
          let result = await getViewDataWithFallback<{ scoreBoard: ScoreBoardData[] }>('score-board', { fallback: fallbackFn });
          if (!result) result = await getViewDataWithFallback<{ scoreBoard: ScoreBoardData[] }>('score', { fallback: fallbackFn });
          if (result?.data?.scoreBoard?.length) {
            setData(result.data.scoreBoard);
            previousDataRef.current = result.data.scoreBoard;
            setLastUpdated(result.timestamp ? new Date(result.timestamp) : new Date());
            setDataSource(result.source);
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
    const unregister = refreshContext.registerRefetch('score-board', (options) =>
      refetch(options?.skipFetch ? { skipFetch: true } : true)
    );
    return unregister;
  }, [refreshContext, refetch]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    dataSource,
    refetch,
  };
}

