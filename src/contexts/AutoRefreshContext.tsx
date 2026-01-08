import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from 'react';
import { useRefresh } from './RefreshContext';
import { useTranslation } from 'react-i18next';

interface AutoRefreshContextType {
  enabled: boolean;
  interval: number;
  setEnabled: (enabled: boolean) => void;
  setInterval: (interval: number) => void;
  lastRefreshTime: Date | null;
}

const AutoRefreshContext = createContext<AutoRefreshContextType | undefined>(undefined);

// LocalStorage keys
const STORAGE_KEY_ENABLED = 'autoRefreshEnabled';
const STORAGE_KEY_INTERVAL = 'autoRefreshInterval';

// Default values
const DEFAULT_ENABLED = true;
const DEFAULT_INTERVAL = 30 * 60 * 1000; // 30 minutes in milliseconds

// Valid intervals (in milliseconds)
export const AUTO_REFRESH_INTERVALS = {
  OFF: 0,
  MIN_15: 15 * 60 * 1000, // 15 minutes
  MIN_30: 30 * 60 * 1000, // 30 minutes
  MIN_60: 60 * 60 * 1000, // 60 minutes
} as const;

interface AutoRefreshProviderProps {
  children: ReactNode;
}

export function AutoRefreshProvider({ children }: AutoRefreshProviderProps) {
  const { refreshAll, isRefreshing } = useRefresh();
  const { t } = useTranslation();
  
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
        const validIntervals = [
          AUTO_REFRESH_INTERVALS.OFF,
          AUTO_REFRESH_INTERVALS.MIN_15,
          AUTO_REFRESH_INTERVALS.MIN_30,
          AUTO_REFRESH_INTERVALS.MIN_60,
        ];
        if (!isNaN(parsed) && validIntervals.includes(parsed)) {
          return parsed;
        }
      }
      return DEFAULT_INTERVAL;
    } catch (error) {
      console.warn('Failed to load auto-refresh interval from localStorage:', error);
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
  const setInterval = useCallback((newInterval: number) => {
    setIntervalState(newInterval);
    localStorage.setItem(STORAGE_KEY_INTERVAL, String(newInterval));
  }, []);

  // Handle auto refresh
  const handleAutoRefresh = useCallback(async () => {
    // Skip if page is not visible or manual refresh is in progress
    if (!isPageVisibleRef.current || isRefreshing) {
      return;
    }

    try {
      await refreshAll();
      setLastRefreshTime(new Date());
    } catch (error) {
      console.error('Auto-refresh failed:', error);
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

  const value: AutoRefreshContextType = {
    enabled,
    interval,
    setEnabled,
    setInterval,
    lastRefreshTime,
  };

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

