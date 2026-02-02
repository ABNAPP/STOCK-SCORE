import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchScoreBoardData, ProgressCallback } from '../services/sheets';
import { createScoreBoardTransformer } from '../services/sheets/scoreBoardService';
import { fetchPEIndustryData } from '../services/sheets/peIndustryService';
import { fetchSMAData } from '../services/sheets/smaService';
import type { DataRow } from '../services/sheets';
import { ScoreBoardData, PEIndustryData } from '../types/stock';
import { useLoadingProgress } from '../contexts/LoadingProgressContext';
import { getCachedData, getDeltaCacheEntry, setDeltaCacheEntry, CACHE_KEYS } from '../services/firestoreCacheService';
import { createErrorHandler, logError, formatError, isErrorType } from '../utils/errorHandler';
import { useNotifications } from '../contexts/NotificationContext';
import { detectDataChanges, formatChangeSummary } from '../utils/dataChangeDetector';
import { logger } from '../utils/logger';
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
import { usePageVisibility } from './usePageVisibility';

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || '';
const SHEET_NAME = 'DashBoard';
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
 * - Fetches PE Industry and SMA data separately for calculations
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
export function useScoreBoardData() {
  const [data, setData] = useState<ScoreBoardData[]>([]);
  const [loading, setLoading] = useState(true); // Start with loading state
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { updateProgress } = useLoadingProgress();
  const isPageVisible = usePageVisibility();
  const currentVersionRef = useRef<number>(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { createNotification } = useNotifications();
  const previousDataRef = useRef<ScoreBoardData[]>([]);
  const cacheLoadedRef = useRef<boolean>(false);

  // Helper function to fetch PE Industry and SMA data and create maps
  const fetchDependenciesAndCreateTransformer = useCallback(async (forceRefresh: boolean = false) => {
    // Fetch PEIndustryData and SMAData in parallel (they are independent)
    const [peIndustryResult, smaResult] = await Promise.allSettled([
      fetchPEIndustryData(forceRefresh),
      fetchSMAData(forceRefresh),
    ]);

    // Process PEIndustryData results
    let peIndustryData: PEIndustryData[] = [];
    if (peIndustryResult.status === 'fulfilled') {
      peIndustryData = peIndustryResult.value;
    } else {
      logger.warn(
        'Failed to fetch PE Industry data for P/E1 INDUSTRY calculation',
        { component: 'useScoreBoardData', operation: 'fetchDependenciesAndCreateTransformer', error: peIndustryResult.reason }
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

    // Process SMAData results
    let smaDataMap = new Map<string, { sma100: number | null; sma200: number | null; smaCross: string | null }>();
    if (smaResult.status === 'fulfilled') {
      const smaData = smaResult.value;
      smaData.forEach((sma) => {
        const tickerKey = sma.ticker.toLowerCase().trim();
        smaDataMap.set(tickerKey, {
          sma100: sma.sma100,
          sma200: sma.sma200,
          smaCross: sma.smaCross,
        });
      });
    } else {
      logger.warn(
        'Failed to fetch SMA data for Score Board',
        { component: 'useScoreBoardData', operation: 'fetchDependenciesAndCreateTransformer', error: smaResult.reason }
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
    const smaDataMapObj: Record<string, { sma100: number | null; sma200: number | null; smaCross: string | null }> = {};
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

  // Load data using delta-sync or fallback to regular fetch
  const loadData = useCallback(async (forceRefresh: boolean = false, isBackground: boolean = false) => {
    try {
      if (!isBackground) {
        setLoading(true);
      }
      setError(null);
      
      if (!isBackground) {
        updateProgress('score-board', {
          status: 'loading',
          progress: 0,
          message: 'Loading data...',
        });
      }

      // Try delta-sync if enabled
      if (isDeltaSyncEnabled() && APPS_SCRIPT_URL && !forceRefresh) {
        try {
          // Fetch dependencies first (PE Industry, SMA) for transformer and worker additionalData
          const { transformer, additionalData } = await fetchDependenciesAndCreateTransformer(forceRefresh);

          const config: DeltaSyncConfig = {
            sheetName: SHEET_NAME,
            apiBaseUrl: APPS_SCRIPT_URL,
            dataTypeName: 'Score Board',
            additionalData,
          };

          // Load initial snapshot or use cached data
          const result = await initSync<ScoreBoardData>(
            config,
            CACHE_KEY,
            transformer
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
              { component: 'useScoreBoardData', operation: 'initialize delta sync', sheetName: SHEET_NAME, error: deltaSyncError }
            );
          } else {
            logger.debug(
              `Delta sync timed out for ${SHEET_NAME}, using regular fetch instead`,
              { component: 'useScoreBoardData', operation: 'initialize delta sync', sheetName: SHEET_NAME }
            );
          }
          // Don't throw - fallback to regular fetch
        }
      }

      // Fallback to regular fetch
      const progressCallback: ProgressCallback = (progress) => {
        if (!isBackground) {
          updateProgress('score-board', {
            progress: progress.percentage,
            status: progress.stage === 'complete' ? 'complete' : 'loading',
            message: progress.message,
            rowsLoaded: progress.rowsProcessed,
            totalRows: progress.totalRows,
          });
        }
      };
      
      logger.debug('Fetching Score Board data', { 
        component: 'useScoreBoardData', 
        operation: 'loadData',
        forceRefresh,
        isBackground 
      });
      
      const fetchedData = await fetchScoreBoardData(forceRefresh, progressCallback);
      
      logger.info('Score Board data fetched successfully', { 
        component: 'useScoreBoardData', 
        operation: 'loadData',
        entryCount: fetchedData.length,
        forceRefresh 
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
      const errorHandler = createErrorHandler({
        operation: 'fetch Score Board data',
        component: 'useScoreBoardData',
        additionalInfo: { forceRefresh, isBackground },
      });
      const formatted = errorHandler(err);
      setError(formatted.userMessage);
      if (!isBackground) {
        updateProgress('score-board', {
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
  }, [updateProgress, createNotification, fetchDependenciesAndCreateTransformer]);

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
        dataTypeName: 'Score Board',
      };

      const changesResponse = await pollChanges(config, currentVersionRef.current);
      const cacheResult = await applyChangesToCache<ScoreBoardData>(changesResponse, CACHE_KEY);

      if (cacheResult.needsReload) {
        // Changes detected, reload snapshot
        // First fetch dependencies (transformer has maps closed over)
        const { transformer } = await fetchDependenciesAndCreateTransformer(false);

        // Load snapshot
        const snapshot = await loadSnapshot(config);
        const transformerFormat = snapshotToTransformerFormat(snapshot);
        const transformedData = transformer(transformerFormat);
        setDeltaCacheEntry(CACHE_KEY, transformedData, snapshot.version, true);
        
        // Detect data changes
        const dataChanges = detectDataChanges(
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
      } else if (cacheResult.data) {
        // No changes, use cached data
        setData(cacheResult.data);
        currentVersionRef.current = cacheResult.version;
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

  // Load cache on mount - check Firestore cache first
  useEffect(() => {
    const loadCache = async () => {
      if (cacheLoadedRef.current) return;
      cacheLoadedRef.current = true;
      
      try {
        // Try delta cache first, then fallback to regular cache
        const deltaCacheEntry = await getDeltaCacheEntry<ScoreBoardData[]>(CACHE_KEY);
        const regularCache = deltaCacheEntry ? null : await getCachedData<ScoreBoardData[]>(CACHE_KEY);
        const cachedData = deltaCacheEntry?.data || regularCache;
        
        if (cachedData && cachedData.length > 0) {
          setData(cachedData);
          previousDataRef.current = cachedData;
          currentVersionRef.current = deltaCacheEntry?.version || 0;
          setLoading(false);
          // Don't fetch if we have valid cache - hard cache, no initial fetch; polling still updates in background
          return;
        }
        // No cache, fetch fresh data
      } catch (err) {
        // If cache load fails, log and continue to fetch fresh data
        logger.warn('Failed to load cache, fetching fresh data', { 
          component: 'useScoreBoardData', 
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

