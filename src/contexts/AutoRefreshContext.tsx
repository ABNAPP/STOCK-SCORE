import { createContext, useContext, ReactNode, useMemo } from 'react';

/**
 * AutoRefreshContext - Deprecated
 * 
 * Auto-refresh functionality has been removed. Cache now automatically refreshes
 * every 30 minutes via Firestore TTL. This context is kept for backward compatibility
 * but provides no functionality.
 * 
 * @deprecated This context is no longer used. Cache refreshes automatically via Firestore TTL.
 */
interface AutoRefreshContextType {
  enabled: boolean;
  interval: number;
  setEnabled: (enabled: boolean) => void;
  setIntervalValue: (interval: number) => void;
  lastRefreshTime: Date | null;
}

const AutoRefreshContext = createContext<AutoRefreshContextType | undefined>(undefined);

interface AutoRefreshProviderProps {
  children: ReactNode;
}

/**
 * AutoRefreshProvider - Deprecated
 * 
 * Provides a minimal context for backward compatibility.
 * Auto-refresh functionality has been removed - cache now refreshes automatically
 * every 30 minutes via Firestore TTL.
 * 
 * @deprecated This provider is kept for backward compatibility but provides no functionality.
 */
export function AutoRefreshProvider({ children }: AutoRefreshProviderProps) {
  // Minimal stub implementation - no auto-refresh logic
  // Cache now automatically refreshes via Firestore TTL (30 minutes)
  const value: AutoRefreshContextType = useMemo(() => ({
    enabled: false,
    interval: 0,
    setEnabled: () => {
      // No-op: auto-refresh is disabled
    },
    setIntervalValue: () => {
      // No-op: auto-refresh is disabled
    },
    lastRefreshTime: null,
  }), []);

  return (
    <AutoRefreshContext.Provider value={value}>
      {children}
    </AutoRefreshContext.Provider>
  );
}

/**
 * useAutoRefresh - Deprecated
 * 
 * Auto-refresh functionality has been removed. Cache now automatically refreshes
 * every 30 minutes via Firestore TTL.
 * 
 * @deprecated This hook is kept for backward compatibility but returns stub values.
 */
export function useAutoRefresh(): AutoRefreshContextType {
  const context = useContext(AutoRefreshContext);
  if (context === undefined) {
    throw new Error('useAutoRefresh must be used within an AutoRefreshProvider');
  }
  return context;
}

/**
 * AUTO_REFRESH_INTERVALS - Deprecated
 * 
 * Auto-refresh intervals are no longer used. Cache refreshes automatically
 * every 30 minutes via Firestore TTL.
 * 
 * @deprecated This export is kept for backward compatibility only.
 */
export const AUTO_REFRESH_INTERVALS = {
  OFF: 0,
  HOUR_1: 1 * 60 * 60 * 1000, // 1 hour
  HOUR_3: 3 * 60 * 60 * 1000, // 3 hours
} as const;

