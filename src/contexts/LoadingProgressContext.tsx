import { createContext, useContext, ReactNode, useState, useCallback, useMemo, useEffect } from 'react';

export interface DataSourceProgress {
  name: string;
  progress: number; // 0-100
  status: 'pending' | 'loading' | 'complete' | 'error';
  estimatedTimeRemaining?: number; // milliseconds
  rowsLoaded?: number;
  totalRows?: number;
  startTime?: number;
  message?: string;
}

interface LoadingProgressContextType {
  dataSources: Map<string, DataSourceProgress>;
  totalProgress: number;
  estimatedTimeRemaining: number;
  isAnyLoading: boolean;
  updateProgress: (source: string, progress: Partial<DataSourceProgress>) => void;
  reset: () => void;
  getDataSource: (source: string) => DataSourceProgress | undefined;
}

const LoadingProgressContext = createContext<LoadingProgressContextType | undefined>(undefined);

// Standard estimated times for different data sources (in milliseconds)
const DEFAULT_ESTIMATED_TIMES: Record<string, number> = {
  'score-board': 4000,
  'benjamin-graham': 2500,
  'sma': 2500,
  'pe-industry': 1500,
  'threshold-industry': 1500,
};

// Load historical data from localStorage
function getHistoricalTime(source: string): number | null {
  try {
    const key = `loadTime:${source}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      return parseFloat(stored);
    }
  } catch (error) {
    console.error(`Error loading historical time for ${source}:`, error);
  }
  return null;
}

// Save historical data to localStorage
function saveHistoricalTime(source: string, time: number): void {
  try {
    const key = `loadTime:${source}`;
    localStorage.setItem(key, String(time));
  } catch (error) {
    console.error(`Error saving historical time for ${source}:`, error);
  }
}

interface LoadingProgressProviderProps {
  children: ReactNode;
}

export function LoadingProgressProvider({ children }: LoadingProgressProviderProps) {
  const [dataSources, setDataSources] = useState<Map<string, DataSourceProgress>>(new Map());

  const updateProgress = useCallback((source: string, progressUpdate: Partial<DataSourceProgress>) => {
    setDataSources((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(source);
      
      // Initialize if doesn't exist
      if (!existing) {
        const historicalTime = getHistoricalTime(source);
        const estimatedTime = historicalTime || DEFAULT_ESTIMATED_TIMES[source] || 3000;
        
        newMap.set(source, {
          name: source,
          progress: 0,
          status: 'pending',
          estimatedTimeRemaining: estimatedTime,
          startTime: Date.now(),
          ...progressUpdate,
        });
      } else {
        // Update existing
        const updated: DataSourceProgress = {
          ...existing,
          ...progressUpdate,
        };
        
        // Calculate estimated time remaining based on progress
        if (updated.progress > 0 && updated.startTime) {
          const elapsed = Date.now() - updated.startTime;
          const estimatedTotal = (elapsed / updated.progress) * 100;
          updated.estimatedTimeRemaining = Math.max(0, estimatedTotal - elapsed);
        }
        
        // Save historical time when complete
        if (updated.status === 'complete' && updated.startTime) {
          const totalTime = Date.now() - updated.startTime;
          saveHistoricalTime(source, totalTime);
        }
        
        newMap.set(source, updated);
      }
      
      return newMap;
    });
  }, []);

  const reset = useCallback(() => {
    setDataSources(new Map());
  }, []);

  const getDataSource = useCallback((source: string) => {
    return dataSources.get(source);
  }, [dataSources]);

  // Calculate total progress
  const totalProgress = useMemo(() => {
    if (dataSources.size === 0) return 0;
    
    let total = 0;
    let count = 0;
    dataSources.forEach((source) => {
      total += source.progress;
      count++;
    });
    
    return count > 0 ? Math.round(total / count) : 0;
  }, [dataSources]);

  // Calculate total estimated time remaining
  const estimatedTimeRemaining = useMemo(() => {
    let maxTime = 0;
    dataSources.forEach((source) => {
      if (source.status === 'loading' && source.estimatedTimeRemaining) {
        maxTime = Math.max(maxTime, source.estimatedTimeRemaining);
      }
    });
    return maxTime;
  }, [dataSources]);

  // Check if any data source is loading
  const isAnyLoading = useMemo(() => {
    for (const source of dataSources.values()) {
      if (source.status === 'loading' || source.status === 'pending') {
        return true;
      }
    }
    return false;
  }, [dataSources]);

  const value: LoadingProgressContextType = {
    dataSources,
    totalProgress,
    estimatedTimeRemaining,
    isAnyLoading,
    updateProgress,
    reset,
    getDataSource,
  };

  return (
    <LoadingProgressContext.Provider value={value}>
      {children}
    </LoadingProgressContext.Provider>
  );
}

export function useLoadingProgress(): LoadingProgressContextType {
  const context = useContext(LoadingProgressContext);
  if (context === undefined) {
    throw new Error('useLoadingProgress must be used within a LoadingProgressProvider');
  }
  return context;
}

