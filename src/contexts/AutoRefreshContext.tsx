import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback, useMemo } from 'react';
import { useRefresh } from './RefreshContext';
import { useTranslation } from 'react-i18next';
import { logger } from '../utils/logger';

interface AutoRefreshContextType {
  enabled: boolean;
  interval: number;
  setEnabled: (enabled: boolean) => void;
  setIntervalValue: (interval: number) => void;
  lastRefreshTime: Date | null;
}

const AutoRefreshContext = createContext<AutoRefreshContextType | undefined>(undefined);

// LocalStorage keys
const STORAGE_KEY_ENABLED = 'autoRefreshEnabled';
const STORAGE_KEY_INTERVAL = 'autoRefreshInterval';

// Default values
const DEFAULT_ENABLED = true;
const DEFAULT_INTERVAL = 1 * 60 * 60 * 1000; // 1 hour in milliseconds

// Valid intervals (in milliseconds)
export const AUTO_REFRESH_INTERVALS = {
  OFF: 0,
  HOUR_1: 1 * 60 * 60 * 1000, // 1 hour
  HOUR_3: 3 * 60 * 60 * 1000, // 3 hours
} as const;

interface AutoRefreshProviderProps {
  children: ReactNode;
}

export function AutoRefreshProvider({ children }: AutoRefreshProviderProps) {
  const { t } = useTranslation();
  
  // CRITICAL: RefreshProvider MUST be a parent component for useRefresh() to work
  // Provider order in App.tsx MUST be: LoadingProgressProvider → RefreshProvider → AutoRefreshProvider
  // 
  // If this throws an error "useRefresh must be used within a RefreshProvider", it means:
  // 1. RefreshProvider is not wrapping AutoRefreshProvider in App.tsx
  // 2. Or RefreshProvider failed to render its context provider correctly
  // 
  // Hooks cannot be wrapped in try-catch, so provider order MUST be correct.
  // Check App.tsx (around line 140) to ensure correct nesting:
  //   <LoadingProgressProvider>
  //     <RefreshProvider>
  //       <AutoRefreshProvider>...</AutoRefreshProvider>
  //     </RefreshProvider>
  //   </LoadingProgressProvider>
  
  // Debug: Log before calling useRefresh to verify provider is available
  if (import.meta.env.DEV) {
    logger.debug('AutoRefreshProvider: About to call useRefresh()...', { component: 'AutoRefreshContext' });
  }
  
  const { refreshAll, isRefreshing } = useRefresh();
  
  // Debug: Log after successfully getting context
  if (import.meta.env.DEV) {
    logger.debug('AutoRefreshProvider: Successfully got RefreshContext', {
      hasRefreshAll: !!refreshAll,
      isRefreshing,
    });
  }
  
  // Load settings from localStorage
  const [enabled, setEnabledState] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_ENABLED);
    return saved !== null ? saved === 'true' : DEFAULT_ENABLED;
  });
  
  const [interval, setIntervalState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_INTERVAL);
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        // Validate that parsed value is a valid interval
        // Also handle migration from old MIN_30/MIN_60 values to new HOUR_1/HOUR_3
        const validIntervals = [
          AUTO_REFRESH_INTERVALS.OFF,
          AUTO_REFRESH_INTERVALS.HOUR_1,
          AUTO_REFRESH_INTERVALS.HOUR_3,
        ];
        // Legacy migration: MIN_30 (30 min) → HOUR_1, MIN_60 (60 min) → HOUR_1
        const legacyMin30 = 30 * 60 * 1000;
        const legacyMin60 = 60 * 60 * 1000;
        if (parsed === legacyMin30 || parsed === legacyMin60) {
          return AUTO_REFRESH_INTERVALS.HOUR_1;
        }
        if (!isNaN(parsed) && validIntervals.includes(parsed)) {
          return parsed;
        }
      }
      return DEFAULT_INTERVAL;
    } catch (error) {
      logger.warn('Failed to load auto-refresh interval from localStorage', { component: 'AutoRefreshContext', error });
      return DEFAULT_INTERVAL;
    }
  });
  
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPageVisibleRef = useRef<boolean>(!document.hidden);

  // Save enabled state to localStorage
  const setEnabled = useCallback((newEnabled: boolean) => {
    setEnabledState(newEnabled);
    localStorage.setItem(STORAGE_KEY_ENABLED, String(newEnabled));
  }, []);

  // Save interval to localStorage
  const setIntervalValue = useCallback((newInterval: number) => {
    setIntervalState(newInterval);
    localStorage.setItem(STORAGE_KEY_INTERVAL, String(newInterval));
  }, []);

  // Handle auto refresh
  const handleAutoRefresh = useCallback(async () => {
    // Skip if page is not visible, manual refresh is in progress, or refreshAll is not available
    // refreshAll may be null if RefreshProvider is not properly configured
    if (!isPageVisibleRef.current || isRefreshing || !refreshAll) {
      return;
    }

    try {
      await refreshAll();
      setLastRefreshTime(new Date());
    } catch (error) {
      logger.error('Auto-refresh failed', error, { component: 'AutoRefreshContext', operation: 'handleAutoRefresh' });
    }
  }, [refreshAll, isRefreshing]);

  // Setup interval for auto refresh
  useEffect(() => {
    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Only setup interval if enabled and interval > 0
    if (enabled && interval > 0) {
      intervalRef.current = setInterval(() => {
        handleAutoRefresh();
      }, interval);
    }

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, interval, handleAutoRefresh]);

  // Handle Page Visibility API
  useEffect(() => {
    const handleVisibilityChange = () => {
      isPageVisibleRef.current = !document.hidden;
      
      // If page becomes visible and auto-refresh is enabled, trigger refresh immediately
      // (optional: only if it's been a while since last refresh)
      if (!document.hidden && enabled && interval > 0 && !isRefreshing) {
        const now = Date.now();
        const timeSinceLastRefresh = lastRefreshTime 
          ? now - lastRefreshTime.getTime() 
          : Infinity;
        
        // Refresh if it's been more than half the interval since last refresh
        if (timeSinceLastRefresh > interval / 2) {
          handleAutoRefresh();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, interval, isRefreshing, lastRefreshTime, handleAutoRefresh]);

  const value: AutoRefreshContextType = useMemo(() => ({
    enabled,
    interval,
    setEnabled,
    setIntervalValue,
    lastRefreshTime,
  }), [enabled, interval, setEnabled, setIntervalValue, lastRefreshTime]);

  return (
    <AutoRefreshContext.Provider value={value}>
      {children}
    </AutoRefreshContext.Provider>
  );
}

export function useAutoRefresh(): AutoRefreshContextType {
  const context = useContext(AutoRefreshContext);
  if (context === undefined) {
    throw new Error('useAutoRefresh must be used within an AutoRefreshProvider');
  }
  return context;
}

