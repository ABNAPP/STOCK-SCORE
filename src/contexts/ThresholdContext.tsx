import { createContext, useContext, ReactNode, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { ThresholdIndustryData } from '../types/stock';
import { useAuth } from './AuthContext';
import {
  loadSharedThresholdValues,
  saveSharedThresholdValues,
  loadFromLocalStorage,
  saveToLocalStorage,
  type ThresholdValues,
} from '../services/sharedThresholdService';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { logger } from '../utils/logger';

export type { ThresholdValues } from '../services/sharedThresholdService';

interface ThresholdContextType {
  getThresholdValue: (industry: string) => ThresholdValues | undefined;
  getFieldValue: (industry: string, field: keyof ThresholdValues) => number;
  setFieldValue: (industry: string, field: keyof ThresholdValues, value: number) => void;
  commitField: (industry: string, field: keyof ThresholdValues) => Promise<void>;
  initializeFromData: (data: ThresholdIndustryData[]) => void;
  thresholdValues: Map<string, ThresholdValues>; // Computed for backward compatibility
}

export const ThresholdContext = createContext<ThresholdContextType | undefined>(undefined);

// Load from localStorage (fallback) - uses sharedThresholdService key
const loadFromStorage = (): Map<string, ThresholdValues> => {
  const loaded = loadFromLocalStorage();
  if (loaded) {
    return new Map(Object.entries(loaded));
  }
  return new Map();
};

// Save to localStorage (read-cache only)
const saveToStorage = (values: Map<string, ThresholdValues>) => {
  saveToLocalStorage(Object.fromEntries(values));
};

interface ThresholdProviderProps {
  children: ReactNode;
}

export function ThresholdProvider({ children }: ThresholdProviderProps) {
  const { currentUser, userRole } = useAuth();
  // serverRows: source of truth from Firestore
  const [serverRows, setServerRows] = useState<Map<string, ThresholdValues>>(() => loadFromStorage());
  // draft: only fields user is currently editing (e.g. "Technology.irr": 15)
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dirtyKeysRef = useRef<Set<string>>(new Set()); // Set of "industry.field" that are being edited
  const isInitialLoadRef = useRef(true); // Track initial load to prevent listener from processing during load

  // Load data from Firestore and set up real-time listener
  useEffect(() => {
    if (!currentUser) {
      // If no user, just load from localStorage
      const localData = loadFromStorage();
      if (localData.size > 0) {
        setServerRows(localData);
      }
      setIsLoading(false);
      isInitialLoadRef.current = false;
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      isInitialLoadRef.current = true;
      try {
        const loaded = await loadSharedThresholdValues(currentUser);
        if (loaded) {
          setServerRows(new Map(Object.entries(loaded)));
        } else {
          // If no Firestore data, try localStorage
          const localData = loadFromStorage();
          if (localData.size > 0) {
            setServerRows(localData);
          }
        }
      } catch (error: unknown) {
        logger.error('Error loading shared threshold', error, {
          component: 'ThresholdContext',
          operation: 'sharedThreshold.loadFailed',
        });
        const localData = loadFromStorage();
        if (localData.size > 0) {
          setServerRows(localData);
        }
      } finally {
        setIsLoading(false);
        // Mark initial load as complete after a short delay to ensure data is set
        setTimeout(() => {
          isInitialLoadRef.current = false;
        }, 100);
      }
    };

    loadData();

    // Set up real-time listener for changes from other users
    const docRef = doc(db, 'sharedData', 'threshold');
    const unsubscribe = onSnapshot(
      docRef,
      (docSnapshot) => {
        // Skip during initial load
        if (isInitialLoadRef.current) {
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
        logger.error('Error listening to Threshold values', error, { component: 'ThresholdContext', operation: 'listenToThresholdValues' });
      }
    );

    return () => {
      unsubscribe();
    };
  }, [currentUser?.uid]); // Removed isLoading from dependencies - listener should only recreate when user changes

  // Auto-save draft values to Firestore (debounced) - admin only
  useEffect(() => {
    if (isLoading || !currentUser || userRole !== 'admin' || Object.keys(draft).length === 0) {
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

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

    saveToStorage(currentState);

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const obj = Object.fromEntries(currentState);
        await saveSharedThresholdValues(obj, { user: currentUser, userRole });
        dirtyKeysRef.current.clear();
        setDraft({});
      } catch (error: unknown) {
        if ((error as Error).message === 'sharedThreshold.saveDenied') {
          logger.warn('Threshold save denied (viewer)', {
            component: 'ThresholdContext',
            operation: 'sharedThreshold.saveDenied',
          });
        } else {
          logger.error('Error saving shared threshold to Firestore', error, {
            component: 'ThresholdContext',
            operation: 'sharedThreshold.saveFailed',
          });
        }
      }
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [draft, serverRows, currentUser, userRole, isLoading]);

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

  // While typing: mark dirty + update draft. Viewer: no-op.
  const setFieldValue = useCallback(
    (industry: string, field: keyof ThresholdValues, value: number) => {
      if (userRole !== 'admin') {
        logger.warn('setFieldValue denied: viewer cannot edit', {
          component: 'ThresholdContext',
          operation: 'sharedThreshold.setFieldValueDenied',
        });
        return;
      }

      const dk = `${industry}.${field}`;
      dirtyKeysRef.current.add(dk);
      setDraft((d) => ({ ...d, [dk]: value }));
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
    },
    [userRole]
  );

  // Commit to Firestore on blur/enter. Viewer: no-op, return early.
  const commitField = useCallback(
    async (industry: string, field: keyof ThresholdValues) => {
      if (userRole !== 'admin') return;

      const dk = `${industry}.${field}`;
      const value = draft[dk];
      if (value === undefined) return;

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
        const allValues = Object.fromEntries(serverRows);
        allValues[industry] = updated;
        await saveSharedThresholdValues(allValues, { user: currentUser, userRole });
        dirtyKeysRef.current.delete(dk);
        setDraft((d) => {
          const { [dk]: _, ...rest } = d;
          return rest;
        });
        setServerRows((rows) => {
          const newRows = new Map(rows);
          newRows.set(industry, updated);
          return newRows;
        });
      } catch (error: unknown) {
        if ((error as Error).message !== 'sharedThreshold.saveDenied') {
          logger.error('Error committing field to Firestore', error, {
            component: 'ThresholdContext',
            operation: 'sharedThreshold.saveFailed',
          });
        }
      }
    },
    [draft, serverRows, currentUser, userRole]
  );

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
