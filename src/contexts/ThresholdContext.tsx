import { createContext, useContext, ReactNode, useState, useCallback, useEffect, useRef } from 'react';
import { ThresholdIndustryData } from '../types/stock';
import { useAuth } from './AuthContext';
import { saveThresholdValues, loadThresholdValues } from '../services/userDataService';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '../config/firebase';

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
  const [thresholdValues, setThresholdValuesState] = useState<Map<string, ThresholdValues>>(() => loadFromStorage());
  const [isLoading, setIsLoading] = useState(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dirtyKeysRef = useRef<Set<string>>(new Set()); // Set of "industry.field" that are being edited

  // Load data from Firestore and set up real-time listener
  useEffect(() => {
    if (!currentUser) {
      // If no user, just load from localStorage
      const localData = loadFromStorage();
      if (localData.size > 0) {
        setThresholdValuesState(localData);
      }
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      try {
        const loaded = await loadThresholdValues(currentUser);
        if (loaded) {
          setThresholdValuesState(new Map(Object.entries(loaded)));
        } else {
          // If no Firestore data, try localStorage
          const localData = loadFromStorage();
          if (localData.size > 0) {
            setThresholdValuesState(localData);
          }
        }
      } catch (error) {
        console.error('Error loading Threshold values:', error);
        // Fallback to localStorage
        const localData = loadFromStorage();
        if (localData.size > 0) {
          setThresholdValuesState(localData);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    // Set up real-time listener for changes from other devices
    const docRef = doc(db, 'userData', currentUser.uid, 'threshold', 'data');
    const unsubscribe = onSnapshot(
      docRef,
      (docSnapshot) => {
        // Skip during initial load
        if (isLoading) {
          return;
        }
        
        // Ignore our own pending writes
        if (docSnapshot.metadata.hasPendingWrites) {
          return;
        }
        
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          const remoteValues = data.values || {};
          
          // MERGE remote changes instead of replacing everything
          setThresholdValuesState((prev) => {
            const newMap = new Map(prev);
            let hasChanges = false;
            
            // Process each remote value
            for (const [industry, remoteValue] of Object.entries(remoteValues)) {
              const remoteThreshold = remoteValue as ThresholdValues;
              const currentThreshold = newMap.get(industry);
              
              // If this industry doesn't exist locally, add it
              if (!currentThreshold) {
                newMap.set(industry, remoteThreshold);
                hasChanges = true;
                continue;
              }
              
              // Merge remote into current, but preserve dirty fields
              const merged: ThresholdValues = { ...currentThreshold };
              let industryHasChanges = false;
              
              // Check each field in ThresholdValues
              const fields: Array<keyof ThresholdValues> = [
                'irr', 'leverageF2Min', 'leverageF2Max', 'ro40Min', 'ro40Max',
                'cashSdebtMin', 'cashSdebtMax', 'currentRatioMin', 'currentRatioMax'
              ];
              
              for (const field of fields) {
                const dirtyKey = `${industry}.${field}`;
                
                // If this field is dirty (being edited), keep the local value
                if (dirtyKeysRef.current.has(dirtyKey)) {
                  continue; // Skip this field, keep local value
                }
                
                // Otherwise, use remote value if it's different
                if (remoteThreshold[field] !== undefined && remoteThreshold[field] !== currentThreshold[field]) {
                  merged[field] = remoteThreshold[field];
                  industryHasChanges = true;
                }
              }
              
              if (industryHasChanges) {
                newMap.set(industry, merged);
                hasChanges = true;
              }
            }
            
            if (hasChanges) {
              // Also update localStorage
              saveToStorage(newMap);
              return newMap;
            }
            return prev;
          });
        }
      },
      (error) => {
        console.error('Error listening to Threshold values:', error);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [currentUser?.uid]); // Reload when user changes

  // Save to Firestore whenever thresholdValues changes (debounced)
  useEffect(() => {
    if (isLoading || !currentUser) return; // Don't save during initial load

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
        // After successful save, clear dirty keys for all fields that were saved
        // This allows future remote updates to come through
        dirtyKeysRef.current.clear();
      } catch (error) {
        console.error('Error saving Threshold values to Firestore:', error);
        // On error, keep dirty keys so user's edits aren't lost
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
    // Mark this field as dirty BEFORE state update
    const dirtyKey = `${industry}.${field}`;
    dirtyKeysRef.current.add(dirtyKey);
    
    setThresholdValuesState((prev) => {
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
    // Mark all changed fields as dirty BEFORE state update
    Object.keys(values).forEach((field) => {
      const dirtyKey = `${industry}.${field}`;
      dirtyKeysRef.current.add(dirtyKey);
    });
    
    setThresholdValuesState((prev) => {
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
    setThresholdValuesState((prev) => {
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
