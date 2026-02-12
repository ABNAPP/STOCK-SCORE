import { createContext, useContext, ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';
import { useToast } from './ToastContext';
import { useNotifications } from './NotificationContext';
import { useLoadingProgress } from './LoadingProgressContext';
import { useTranslation } from 'react-i18next';
import { requestClearApiCache } from '../utils/serviceWorkerRegistration';
import { clearCache } from '../services/firestoreCacheService';
import { logger } from '../utils/logger';

/** Data sources that can register refetch functions */
export type DataSourceId = 'score-board' | 'benjamin-graham' | 'pe-industry';

/** Options for refetch - skipFetch: only read from viewData (after adminRefreshCache) */
export interface RefetchOptions {
  skipFetch?: boolean;
}

interface RefreshContextType {
  refreshAll: () => Promise<void>;
  isRefreshing: boolean;
  /** Register a refetch function. Returns unregister callback for cleanup on unmount. */
  registerRefetch: (sourceId: DataSourceId, refetch: (options?: RefetchOptions) => Promise<void>) => () => void;
  // Individual refetch functions (trigger only registered refetches for that source)
  refreshBenjaminGraham: () => Promise<void>;
  refreshScoreBoard: () => Promise<void>;
  refreshPEIndustry: () => Promise<void>;
}

const RefreshContext = createContext<RefreshContextType | undefined>(undefined);

interface RefreshProviderProps {
  children: ReactNode;
}

/** Registry: sourceId -> Set of refetch functions. Each mounted hook instance registers. */
type RefetchRegistry = Map<DataSourceId, Set<(options?: RefetchOptions) => Promise<void>>>;

export function RefreshProvider({ children }: RefreshProviderProps) {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const { createNotification } = useNotifications();
  const { reset: resetProgress } = useLoadingProgress();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const registryRef = useRef<RefetchRegistry>(new Map());

  const registerRefetch = useCallback((sourceId: DataSourceId, refetch: (options?: RefetchOptions) => Promise<void>) => {
    const registry = registryRef.current;
    if (!registry.has(sourceId)) {
      registry.set(sourceId, new Set());
    }
    registry.get(sourceId)!.add(refetch);
    return () => {
      registry.get(sourceId)?.delete(refetch);
      if (registry.get(sourceId)?.size === 0) registry.delete(sourceId);
    };
  }, []);

  const callRefetchesForSource = useCallback(
    async (sourceId: DataSourceId, options?: RefetchOptions): Promise<PromiseSettledResult<void>[]> => {
      const set = registryRef.current.get(sourceId);
      if (!set || set.size === 0) return [];
      const promises = Array.from(set).map((fn) => fn(options));
      return Promise.allSettled(promises);
    },
    []
  );

  const refreshAll = useCallback(async () => {
    try {
      setIsRefreshing(true);
      logger.info('Refresh Now: Clearing cache', { component: 'RefreshContext', operation: 'refreshAll' });
      await clearCache();

      logger.info('Refresh Now: Calling adminRefreshCache (server-side)', { component: 'RefreshContext', operation: 'refreshAll' });
      const adminRefresh = httpsCallable<{ viewIds?: string[]; force?: boolean; dryRun?: boolean }, { ok: boolean; refreshed: unknown[]; errors: string[] }>(
        functions,
        'adminRefreshCache'
      );
      const result = await adminRefresh({ force: true });
      const data = result.data;

      if (!data?.ok) {
        throw new Error(data?.errors?.join('; ') || 'adminRefreshCache failed');
      }
      if ((data.errors ?? []).length > 0) {
        logger.warn('Refresh Now: adminRefreshCache completed with errors', {
          component: 'RefreshContext',
          operation: 'refreshAll',
          errors: data.errors,
        });
      }

      resetProgress();

      try {
        await requestClearApiCache();
      } catch (swError) {
        logger.warn('Refresh Now: Failed to clear SW cache, continuing', {
          component: 'RefreshContext',
          operation: 'refreshAll',
          error: swError,
        });
      }

      logger.debug('Refresh Now: Triggering refetches (viewData only)', { component: 'RefreshContext', operation: 'refreshAll' });
      const sourceIds: DataSourceId[] = ['score-board', 'benjamin-graham', 'pe-industry'];
      const allResults: PromiseSettledResult<void>[] = [];
      const dataTypeNames = ['ScoreBoard', 'BenjaminGraham', 'PEIndustry'];

      for (let i = 0; i < sourceIds.length; i++) {
        const results = await callRefetchesForSource(sourceIds[i], { skipFetch: true });
        results.forEach((r) => allResults.push(r));
        const dataType = dataTypeNames[i];
        results.forEach((result, idx) => {
          if (result.status === 'fulfilled') {
            logger.info(`Refresh Now: ${dataType} refetch ${idx + 1} completed`, { component: 'RefreshContext', operation: 'refreshAll', dataType });
          } else {
            logger.error(`Refresh Now: ${dataType} refetch ${idx + 1} failed`, {
              component: 'RefreshContext',
              operation: 'refreshAll',
              dataType,
              error: result.reason,
            });
          }
        });
      }

      const hasErrors = allResults.some((r) => r.status === 'rejected');
      if (hasErrors) {
        const errorMessage = t('toast.refreshError', 'Fel vid uppdatering av data');
        showError(errorMessage);
        createNotification('error', 'Data Refresh Failed', errorMessage, { showDesktop: true, persistent: false });
      } else {
        const successMessage = t('toast.refreshSuccess', 'All data har uppdaterats');
        showSuccess(successMessage);
        createNotification('success', 'Data Refresh Complete', successMessage, { showDesktop: false, persistent: false });
      }
    } catch (error: unknown) {
      logger.error('Refresh Now: Unexpected error', { component: 'RefreshContext', operation: 'refreshAll', error });
      const errorMessage = t('toast.refreshError', 'Fel vid uppdatering av data');
      showError(errorMessage);
      createNotification('error', 'Data Refresh Error', errorMessage, { showDesktop: true, persistent: false });
    } finally {
      setIsRefreshing(false);
    }
  }, [callRefetchesForSource, showSuccess, showError, createNotification, t, resetProgress]);

  const refreshBenjaminGraham = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await callRefetchesForSource('benjamin-graham');
    } finally {
      setIsRefreshing(false);
    }
  }, [callRefetchesForSource]);

  const refreshScoreBoard = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await callRefetchesForSource('score-board');
    } finally {
      setIsRefreshing(false);
    }
  }, [callRefetchesForSource]);

  const refreshPEIndustry = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await callRefetchesForSource('pe-industry');
    } finally {
      setIsRefreshing(false);
    }
  }, [callRefetchesForSource]);

  const value: RefreshContextType = useMemo(
    () => ({
      refreshAll,
      isRefreshing,
      registerRefetch,
      refreshBenjaminGraham,
      refreshScoreBoard,
      refreshPEIndustry,
    }),
    [refreshAll, isRefreshing, registerRefetch, refreshBenjaminGraham, refreshScoreBoard, refreshPEIndustry]
  );

  if (import.meta.env.DEV) {
    logger.debug('RefreshProvider: Rendering RefreshContext.Provider', {
      hasRefreshAll: typeof value.refreshAll === 'function',
      isRefreshing: value.isRefreshing,
    });
  }

  return <RefreshContext.Provider value={value}>{children}</RefreshContext.Provider>;
}

export function useRefresh(): RefreshContextType {
  const context = useContext(RefreshContext);
  if (context === undefined) {
    throw new Error(
      'useRefresh must be used within a RefreshProvider.\n\n' +
        'SOLUTION:\n' +
        '1. Check App.tsx - RefreshProvider must wrap AutoRefreshProvider:\n' +
        '   <LoadingProgressProvider>\n' +
        '     <RefreshProvider>\n' +
        '       <AutoRefreshProvider>...</AutoRefreshProvider>\n' +
        '     </RefreshProvider>\n' +
        '   </LoadingProgressProvider>\n' +
        '2. Ensure RefreshProvider is rendered before AutoRefreshProvider in the component tree.\n' +
        '3. Check that RefreshProvider is not conditionally rendered or skipped.'
    );
  }
  return context;
}

/** Returns context or undefined if not within RefreshProvider. Use for optional registration (e.g. in data hooks). */
export function useRefreshOptional(): RefreshContextType | undefined {
  return useContext(RefreshContext);
}
