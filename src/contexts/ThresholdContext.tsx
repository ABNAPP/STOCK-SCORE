import { createContext, useContext, ReactNode, useState, useCallback, useEffect, useRef } from 'react';
import { ThresholdIndustryData } from '../types/stock';
import { useAuth } from './AuthContext';
import { saveThresholdValues, loadThresholdValues } from '../services/userDataService';

export interface ThresholdValues {
  irr: number;
  leverageF2Min: number;
  leverageF2Max: number;
  ro40Min: number;
  ro40Max: number;
  cashSdebtMin: number;
  cashSdebtMax: number;
  currentRatioMin: number;
  currentRatioMax: number;
}

interface ThresholdContextType {
  getThresholdValue: (industry: string) => ThresholdValues | undefined;
  setThresholdValue: (industry: string, field: keyof ThresholdValues, value: number) => void;
  setThresholdValues: (industry: string, values: Partial<ThresholdValues>) => void;
  initializeFromData: (data: ThresholdIndustryData[]) => void;
  thresholdValues: Map<string, ThresholdValues>;
}

export const ThresholdContext = createContext<ThresholdContextType | undefined>(undefined);

const STORAGE_KEY = 'thresholdValues';

// Load from localStorage (fallback)
const loadFromStorage = (): Map<string, ThresholdValues> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return new Map(Object.entries(parsed));
    }
  } catch (error) {
    console.error('Error loading Threshold values from localStorage:', error);
  }
  return new Map();
};

// Save to localStorage (fallback)
const saveToStorage = (values: Map<string, ThresholdValues>) => {
  try {
    const obj = Object.fromEntries(values);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch (error) {
    console.error('Error saving Threshold values to localStorage:', error);
  }
};

interface ThresholdProviderProps {
  children: ReactNode;
}

export function ThresholdProvider({ children }: ThresholdProviderProps) {
  const { currentUser } = useAuth();
  const [thresholdValues, setThresholdValues] = useState<Map<string, ThresholdValues>>(() => loadFromStorage());
  const [isLoading, setIsLoading] = useState(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load data from Firestore when user logs in or component mounts
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const loaded = await loadThresholdValues(currentUser);
        if (loaded) {
          setThresholdValues(new Map(Object.entries(loaded)));
        } else {
          // If no Firestore data, try localStorage
          const localData = loadFromStorage();
          if (localData.size > 0) {
            setThresholdValues(localData);
          }
        }
      } catch (error) {
        console.error('Error loading Threshold values:', error);
        // Fallback to localStorage
        const localData = loadFromStorage();
        if (localData.size > 0) {
          setThresholdValues(localData);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [currentUser?.uid]); // Reload when user changes

  // Save to Firestore whenever thresholdValues changes (debounced)
  useEffect(() => {
    if (isLoading) return; // Don't save during initial load

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Save to localStorage immediately (fast fallback)
    saveToStorage(thresholdValues);

    // Debounce Firestore save to avoid too many writes
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const obj = Object.fromEntries(thresholdValues);
        await saveThresholdValues(currentUser, obj);
      } catch (error) {
        console.error('Error saving Threshold values to Firestore:', error);
      }
    }, 1000); // Wait 1 second after last change

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [thresholdValues, currentUser, isLoading]);

  const getThresholdValue = useCallback((industry: string): ThresholdValues | undefined => {
    return thresholdValues.get(industry);
  }, [thresholdValues]);

  const setThresholdValue = useCallback((industry: string, field: keyof ThresholdValues, value: number) => {
    setThresholdValues((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(industry) || {
        irr: 0,
        leverageF2Min: 0,
        leverageF2Max: 0,
        ro40Min: 0,
        ro40Max: 0,
        cashSdebtMin: 0,
        cashSdebtMax: 0,
        currentRatioMin: 0,
        currentRatioMax: 0,
      };
      
      newMap.set(industry, {
        ...current,
        [field]: value,
      });
      return newMap;
    });
  }, []);

  const setThresholdValues = useCallback((industry: string, values: Partial<ThresholdValues>) => {
    setThresholdValues((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(industry) || {
        irr: 0,
        leverageF2Min: 0,
        leverageF2Max: 0,
        ro40Min: 0,
        ro40Max: 0,
        cashSdebtMin: 0,
        cashSdebtMax: 0,
        currentRatioMin: 0,
        currentRatioMax: 0,
      };
      
      newMap.set(industry, {
        ...current,
        ...values,
      });
      return newMap;
    });
  }, []);

  const initializeFromData = useCallback((data: ThresholdIndustryData[]) => {
    setThresholdValues((prev) => {
      const newMap = new Map(prev);
      data.forEach((item) => {
        if (!newMap.has(item.industry)) {
          newMap.set(item.industry, {
            irr: item.irr || 0,
            leverageF2Min: item.leverageF2Min || 0,
            leverageF2Max: item.leverageF2Max || 0,
            ro40Min: item.ro40Min || 0,
            ro40Max: item.ro40Max || 0,
            cashSdebtMin: item.cashSdebtMin || 0,
            cashSdebtMax: item.cashSdebtMax || 0,
            currentRatioMin: item.currentRatioMin || 0,
            currentRatioMax: item.currentRatioMax || 0,
          });
        }
      });
      return newMap;
    });
  }, []);

  const value: ThresholdContextType = {
    getThresholdValue,
    setThresholdValue,
    setThresholdValues,
    initializeFromData,
    thresholdValues,
  };

  return <ThresholdContext.Provider value={value}>{children}</ThresholdContext.Provider>;
}

export function useThresholdValues(): ThresholdContextType {
  const context = useContext(ThresholdContext);
  if (context === undefined) {
    throw new Error('useThresholdValues must be used within a ThresholdProvider');
  }
  return context;
}
