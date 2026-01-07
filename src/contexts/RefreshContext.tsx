import { createContext, useContext, ReactNode, useCallback } from 'react';
import { useBenjaminGrahamData } from '../hooks/useBenjaminGrahamData';
import { useSMAData } from '../hooks/useSMAData';
import { useScoreBoardData } from '../hooks/useScoreBoardData';
import { usePEIndustryData } from '../hooks/usePEIndustryData';
import { useThresholdIndustryData } from '../hooks/useThresholdIndustryData';
import { useToast } from './ToastContext';
import { useTranslation } from 'react-i18next';
import { clearCache } from '../services/cacheService';
import { useLoadingProgress } from './LoadingProgressContext';

interface RefreshContextType {
  refreshAll: () => Promise<void>;
  isRefreshing: boolean;
  // Individual refetch functions for future use
  refreshBenjaminGraham: () => Promise<void>;
  refreshSMA: () => Promise<void>;
  refreshScoreBoard: () => Promise<void>;
  refreshPEIndustry: () => Promise<void>;
  refreshThresholdIndustry: () => Promise<void>;
}

const RefreshContext = createContext<RefreshContextType | undefined>(undefined);

interface RefreshProviderProps {
  children: ReactNode;
}

export function RefreshProvider({ children }: RefreshProviderProps) {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const { reset: resetProgress } = useLoadingProgress();
  
  // Use all hooks (Stock Score is calculated from ScoreBoard data, so no separate hook needed)
  const benjaminGraham = useBenjaminGrahamData();
  const sma = useSMAData();
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
      const results = await Promise.allSettled([
        benjaminGraham.refetch(true),
        sma.refetch(true),
        scoreBoard.refetch(true),
        peIndustry.refetch(true),
        threshold.refetch(true),
      ]);
      
      const hasErrors = results.some(result => result.status === 'rejected');
      
      if (hasErrors) {
        showError(t('toast.refreshError', 'Fel vid uppdatering av data'));
      } else {
        showSuccess(t('toast.refreshSuccess', 'All data har uppdaterats'));
      }
    } catch (error) {
      showError(t('toast.refreshError', 'Fel vid uppdatering av data'));
    }
  }, [
    benjaminGraham.refetch,
    sma.refetch,
    scoreBoard.refetch,
    peIndustry.refetch,
    threshold.refetch,
    showSuccess,
    showError,
    t,
    resetProgress,
  ]);

  // Check if any refresh is in progress
  const isRefreshing =
    benjaminGraham.loading ||
    sma.loading ||
    scoreBoard.loading ||
    peIndustry.loading ||
    threshold.loading;

  const value: RefreshContextType = {
    refreshAll,
    isRefreshing,
    refreshBenjaminGraham: () => benjaminGraham.refetch(true),
    refreshSMA: () => sma.refetch(true),
    refreshScoreBoard: () => scoreBoard.refetch(true),
    refreshPEIndustry: () => peIndustry.refetch(true),
    refreshThresholdIndustry: () => threshold.refetch(true),
  };

  return <RefreshContext.Provider value={value}>{children}</RefreshContext.Provider>;
}

export function useRefresh(): RefreshContextType {
  const context = useContext(RefreshContext);
  if (context === undefined) {
    throw new Error('useRefresh must be used within a RefreshProvider');
  }
  return context;
}

