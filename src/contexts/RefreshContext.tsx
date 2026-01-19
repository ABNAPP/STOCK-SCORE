import { createContext, useContext, ReactNode, useCallback, useMemo } from 'react';
import { useBenjaminGrahamData } from '../hooks/useBenjaminGrahamData';
import { useScoreBoardData } from '../hooks/useScoreBoardData';
import { usePEIndustryData } from '../hooks/usePEIndustryData';
// Note: Threshold industry data is now static and not synced from external sources
import { useToast } from './ToastContext';
import { useNotifications } from './NotificationContext';
import { useTranslation } from 'react-i18next';
import { clearCache } from '../services/firestoreCacheService';
import { useLoadingProgress } from './LoadingProgressContext';
import { logger } from '../utils/logger';

interface RefreshContextType {
  refreshAll: () => Promise<void>;
  isRefreshing: boolean;
  // Individual refetch functions for future use
  refreshBenjaminGraham: () => Promise<void>;
  refreshScoreBoard: () => Promise<void>;
  refreshPEIndustry: () => Promise<void>;
  // Note: refreshThresholdIndustry removed - threshold data is now static
}

const RefreshContext = createContext<RefreshContextType | undefined>(undefined);

interface RefreshProviderProps {
  children: ReactNode;
}

export function RefreshProvider({ children }: RefreshProviderProps) {
  // These hooks must be available:
  // - useTranslation: Available from i18next (no provider needed)
  // - useToast: Requires ToastProvider (set in main.tsx)
  // - useLoadingProgress: Requires LoadingProgressProvider (parent in App.tsx)
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const { createNotification } = useNotifications();
  const { reset: resetProgress } = useLoadingProgress();
  
  // Use all data hooks (Stock Score is calculated from ScoreBoard data, so no separate hook needed)
  // SMA data is fetched internally by fetchScoreBoardData, so no separate hook needed
  // Threshold industry data is now static and not synced from external sources
  // These hooks use useLoadingProgress which requires LoadingProgressProvider as parent
  const benjaminGraham = useBenjaminGrahamData();
  const scoreBoard = useScoreBoardData();
  const peIndustry = usePEIndustryData();

  // Refresh all data in parallel
  const refreshAll = useCallback(async () => {
    try {
      // Clear cache before refreshing to force fresh data (invalidate Firestore cache)
      await clearCache();
      // Reset progress tracking
      resetProgress();
      
      // Check if any failed
      // Note: SMA data is fetched internally by fetchScoreBoardData, so no separate refresh needed
      // Note: Threshold industry data is now static and not included in refresh
      const results = await Promise.allSettled([
        benjaminGraham.refetch(true),
        scoreBoard.refetch(true),
        peIndustry.refetch(true),
      ]);
      
      const hasErrors = results.some(result => result.status === 'rejected');
      
      if (hasErrors) {
        const errorMessage = t('toast.refreshError', 'Fel vid uppdatering av data');
        showError(errorMessage);
        createNotification(
          'error',
          'Data Refresh Failed',
          errorMessage,
          {
            showDesktop: true,
            persistent: false,
          }
        );
      } else {
        const successMessage = t('toast.refreshSuccess', 'All data har uppdaterats');
        showSuccess(successMessage);
        createNotification(
          'success',
          'Data Refresh Complete',
          successMessage,
          {
            showDesktop: false,
            persistent: false,
          }
        );
      }
    } catch (error: unknown) {
      const errorMessage = t('toast.refreshError', 'Fel vid uppdatering av data');
      showError(errorMessage);
      createNotification(
        'error',
        'Data Refresh Error',
        errorMessage,
        {
          showDesktop: true,
          persistent: false,
        }
      );
    }
  }, [
    benjaminGraham.refetch,
    scoreBoard.refetch,
    peIndustry.refetch,
    showSuccess,
    showError,
    createNotification,
    t,
    resetProgress,
  ]);

  // Check if any refresh is in progress
  // Note: Threshold industry loading is not included since it's now static
  const isRefreshing =
    benjaminGraham.loading ||
    scoreBoard.loading ||
    peIndustry.loading;

  const refreshBenjaminGraham = useCallback(() => benjaminGraham.refetch(true), [benjaminGraham.refetch]);
  const refreshScoreBoard = useCallback(() => scoreBoard.refetch(true), [scoreBoard.refetch]);
  const refreshPEIndustry = useCallback(() => peIndustry.refetch(true), [peIndustry.refetch]);

  const value: RefreshContextType = useMemo(() => ({
    refreshAll,
    isRefreshing,
    refreshBenjaminGraham,
    refreshScoreBoard,
    refreshPEIndustry,
  }), [refreshAll, isRefreshing, refreshBenjaminGraham, refreshScoreBoard, refreshPEIndustry]);

  // CRITICAL: The Provider MUST wrap children for context to be available
  // AutoRefreshProvider (a child) will use useRefresh() which requires this context
  // The context value is set here and will be available to all children components
  
  // Debug logging in development mode only
  if (import.meta.env.DEV) {
    logger.debug('RefreshProvider: Rendering RefreshContext.Provider with value', {
      hasRefreshAll: typeof value.refreshAll === 'function',
      isRefreshing: value.isRefreshing,
      valueKeys: Object.keys(value),
    });
  }
  
  // CRITICAL: This Provider MUST wrap children for context to be available
  // The value prop ensures RefreshContext is available to all children (including AutoRefreshProvider)
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

