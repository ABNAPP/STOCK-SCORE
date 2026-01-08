import { createContext, useContext, ReactNode, useState, useCallback, useEffect, useRef, useMemo } from 'react';
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
  getFieldValue: (industry: string, field: keyof ThresholdValues) => number;
  setFieldValue: (industry: string, field: keyof ThresholdValues, value: number) => void;
  commitField: (industry: string, field: keyof ThresholdValues) => Promise<void>;
  initializeFromData: (data: ThresholdIndustryData[]) => void;
  thresholdValues: Map<string, ThresholdValues>; // Computed for backward compatibility
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
  // serverRows: source of truth from Firestore
  const [serverRows, setServerRows] = useState<Map<string, ThresholdValues>>(() => loadFromStorage());
  // draft: only fields user is currently editing (e.g. "Technology.irr": 15)
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dirtyKeysRef = useRef<Set<string>>(new Set()); // Set of "industry.field" that are being edited

  // Load data from Firestore and set up real-time listener
  useEffect(() => {
    if (!currentUser) {
      // If no user, just load from localStorage
      const localData = loadFromStorage();
      if (localData.size > 0) {
        setServerRows(localData);
      }
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      try {
        const loaded = await loadThresholdValues(currentUser);
        if (loaded) {
          setServerRows(new Map(Object.entries(loaded)));
        } else {
          // If no Firestore data, try localStorage
          const localData = loadFromStorage();
          if (localData.size > 0) {
            setServerRows(localData);
          }
        }
      } catch (error) {
        console.error('Error loading Threshold values:', error);
        // Fallback to localStorage
        const localData = loadFromStorage();
        if (localData.size > 0) {
          setServerRows(localData);
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
          
          // MERGE remote changes - never replace everything
          setServerRows((prev) => {
            const next = new Map(prev);
            let hasChanges = false;
            
            // Process each remote value
            for (const [industry, remoteValue] of Object.entries(remoteValues)) {
              const remoteThreshold = remoteValue as ThresholdValues;
              const prevRow = next.get(industry) || {
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
              
              // Merge remote into existing
              const merged: ThresholdValues = { ...prevRow, ...remoteThreshold };
              
              // Keep local edits while editing (dirty fields should not be overwritten)
              const fields: Array<keyof ThresholdValues> = [
                'irr', 'leverageF2Min', 'leverageF2Max', 'ro40Min', 'ro40Max',
                'cashSdebtMin', 'cashSdebtMax', 'currentRatioMin', 'currentRatioMax'
              ];
              
              for (const field of fields) {
                const dk = `${industry}.${field}`;
                if (dirtyKeysRef.current.has(dk)) {
                  // This field is being edited, keep the local value
                  merged[field] = prevRow[field];
                }
              }
              
              next.set(industry, merged);
              hasChanges = true;
            }
            
            if (hasChanges) {
              // Also update localStorage
              saveToStorage(next);
              return next;
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
  }, [currentUser?.uid, isLoading]);

  // Auto-save draft values to Firestore (debounced)
  useEffect(() => {
    if (isLoading || !currentUser || Object.keys(draft).length === 0) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Build current state from serverRows + draft for saving
    const currentState = new Map(serverRows);
    for (const [draftKey, draftValue] of Object.entries(draft)) {
      const [industry, field] = draftKey.split('.');
      const entry = currentState.get(industry) || {
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
      currentState.set(industry, { ...entry, [field]: draftValue });
    }

    // Save to localStorage immediately (fast fallback)
    saveToStorage(currentState);

    // Debounce Firestore save to avoid too many writes
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const obj = Object.fromEntries(currentState);
        await saveThresholdValues(currentUser, obj);
        // After successful save, release dirty locks + remove draft
        dirtyKeysRef.current.clear();
        setDraft({});
      } catch (error) {
        console.error('Error saving Threshold values to Firestore:', error);
        // On error, keep dirty keys and draft so user's edits aren't lost
      }
    }, 1000); // Wait 1 second after last change

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [draft, serverRows, currentUser, isLoading]);

  // Display value: draft if exists, otherwise server value
  const getFieldValue = useCallback((industry: string, field: keyof ThresholdValues): number => {
    const dk = `${industry}.${field}`;
    
    // If draft exists, return draft value
    if (dk in draft) {
      return draft[dk];
    }
    
    // Otherwise return server value
    const serverEntry = serverRows.get(industry);
    return serverEntry?.[field] ?? 0;
  }, [serverRows, draft]);

  // Backward compatibility: get full ThresholdValues object
  const getThresholdValue = useCallback((industry: string): ThresholdValues | undefined => {
    const serverEntry = serverRows.get(industry);
    
    if (!serverEntry) {
      return undefined;
    }
    
    // Build result from server entry, but replace with draft values if they exist
    const result: ThresholdValues = { ...serverEntry };
    const fields: Array<keyof ThresholdValues> = [
      'irr', 'leverageF2Min', 'leverageF2Max', 'ro40Min', 'ro40Max',
      'cashSdebtMin', 'cashSdebtMax', 'currentRatioMin', 'currentRatioMax'
    ];
    
    for (const field of fields) {
      const dk = `${industry}.${field}`;
      if (dk in draft) {
        result[field] = draft[dk];
      }
    }
    
    return result;
  }, [serverRows, draft]);

  // While typing: mark dirty + update draft (and optionally optimistic update serverRows)
  const setFieldValue = useCallback((industry: string, field: keyof ThresholdValues, value: number) => {
    const dk = `${industry}.${field}`;
    
    // Mark as dirty and update draft
    dirtyKeysRef.current.add(dk);
    setDraft((d) => ({ ...d, [dk]: value }));
    
    // Optional optimistic UI update (keeps tables consistent)
    setServerRows((rows) => {
      const newRows = new Map(rows);
      const current = newRows.get(industry) || {
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
      newRows.set(industry, { ...current, [field]: value });
      return newRows;
    });
  }, []);

  // Commit to Firestore on blur/enter, then release dirty lock
  const commitField = useCallback(async (industry: string, field: keyof ThresholdValues) => {
    const dk = `${industry}.${field}`;
    const value = draft[dk];
    
    if (value === undefined) return;

    // Build the full entry to save
    const serverEntry = serverRows.get(industry) || {
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
    const updated: ThresholdValues = { ...serverEntry, [field]: value };

    try {
      // Save this specific field immediately
      const allValues = Object.fromEntries(serverRows);
      allValues[industry] = updated;
      await saveThresholdValues(currentUser, allValues);
      
      // Release lock + remove draft
      dirtyKeysRef.current.delete(dk);
      setDraft((d) => {
        const { [dk]: _, ...rest } = d;
        return rest;
      });
      
      // Update serverRows with committed value
      setServerRows((rows) => {
        const newRows = new Map(rows);
        newRows.set(industry, updated);
        return newRows;
      });
    } catch (error) {
      console.error('Error committing field to Firestore:', error);
    }
  }, [draft, serverRows, currentUser]);

  const initializeFromData = useCallback((data: ThresholdIndustryData[]) => {
    setServerRows((prev) => {
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

  // Compute thresholdValues from serverRows + draft for backward compatibility
  const thresholdValues = useMemo(() => {
    const result = new Map(serverRows);
    for (const [draftKey, draftValue] of Object.entries(draft)) {
      const [industry, field] = draftKey.split('.');
      const entry = result.get(industry) || {
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
      result.set(industry, { ...entry, [field]: draftValue });
    }
    return result;
  }, [serverRows, draft]);

  const value: ThresholdContextType = {
    getThresholdValue,
    getFieldValue,
    setFieldValue,
    commitField,
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
