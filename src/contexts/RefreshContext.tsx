import { createContext, useContext, ReactNode, useCallback, useMemo } from 'react';
import { useBenjaminGrahamData } from '../hooks/useBenjaminGrahamData';
import { useScoreBoardData } from '../hooks/useScoreBoardData';
import { usePEIndustryData } from '../hooks/usePEIndustryData';
import { useThresholdIndustryData } from '../hooks/useThresholdIndustryData';
import { useToast } from './ToastContext';
import { useNotifications } from './NotificationContext';
import { useTranslation } from 'react-i18next';
import { clearCache } from '../services/cacheService';
import { useLoadingProgress } from './LoadingProgressContext';
import { logger } from '../utils/logger';

interface RefreshContextType {
  refreshAll: () => Promise<void>;
  isRefreshing: boolean;
  // Individual refetch functions for future use
  refreshBenjaminGraham: () => Promise<void>;
  refreshScoreBoard: () => Promise<void>;
  refreshPEIndustry: () => Promise<void>;
  refreshThresholdIndustry: () => Promise<void>;
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
  // These hooks use useLoadingProgress which requires LoadingProgressProvider as parent
  const benjaminGraham = useBenjaminGrahamData();
  const scoreBoard = useScoreBoardData();
  const peIndustry = usePEIndustryData();
  const threshold = useThresholdIndustryData();

  // Refresh all data in parallel
  const refreshAll = useCallback(async () => {
    try {
      // Clear cache before refreshing to force fresh data
      clearCache();
      // Reset progress tracking
      resetProgress();
      
      // Check if any failed
      // Note: SMA data is fetched internally by fetchScoreBoardData, so no separate refresh needed
      const results = await Promise.allSettled([
        benjaminGraham.refetch(true),
        scoreBoard.refetch(true),
        peIndustry.refetch(true),
        threshold.refetch(true),
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
    threshold.refetch,
    showSuccess,
    showError,
    createNotification,
    t,
    resetProgress,
  ]);

  // Check if any refresh is in progress
  const isRefreshing =
    benjaminGraham.loading ||
    scoreBoard.loading ||
    peIndustry.loading ||
    threshold.loading;

  const refreshBenjaminGraham = useCallback(() => benjaminGraham.refetch(true), [benjaminGraham.refetch]);
  const refreshScoreBoard = useCallback(() => scoreBoard.refetch(true), [scoreBoard.refetch]);
  const refreshPEIndustry = useCallback(() => peIndustry.refetch(true), [peIndustry.refetch]);
  const refreshThresholdIndustry = useCallback(() => threshold.refetch(true), [threshold.refetch]);

  const value: RefreshContextType = useMemo(() => ({
    refreshAll,
    isRefreshing,
    refreshBenjaminGraham,
    refreshScoreBoard,
    refreshPEIndustry,
    refreshThresholdIndustry,
  }), [refreshAll, isRefreshing, refreshBenjaminGraham, refreshScoreBoard, refreshPEIndustry, refreshThresholdIndustry]);

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

