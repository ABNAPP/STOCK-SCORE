import { createContext, useContext, ReactNode, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { IndustryThresholdData } from '../types/stock';
import { useAuth } from './AuthContext';
import { collection, doc, onSnapshot, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { logger } from '../utils/logger';

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
  initializeFromData: (data: IndustryThresholdData[]) => void;
  thresholdValues: Map<string, ThresholdValues>; // Computed for backward compatibility
}

export const ThresholdContext = createContext<ThresholdContextType | undefined>(undefined);

interface ThresholdProviderProps {
  children: ReactNode;
}

export function ThresholdProvider({ children }: ThresholdProviderProps) {
  const { currentUser, userRole } = useAuth();
  const [serverRows, setServerRows] = useState<Map<string, ThresholdValues>>(new Map());
  // draft: only fields user is currently editing (e.g. "Technology.irr": 15)
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dirtyKeysRef = useRef<Set<string>>(new Set()); // Set of "industry.field" that are being edited
  const isInitialLoadRef = useRef(true); // Track initial load to prevent listener from processing during load

  // Load data from Firestore and set up real-time listener
  useEffect(() => {
    if (!currentUser) {
      setServerRows(new Map());
      setIsLoading(false);
      isInitialLoadRef.current = false;
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      isInitialLoadRef.current = true;
      try {
        const values: Record<string, ThresholdValues> = {};
        const snapshot = await getDocs(collection(db, 'industryThresholds'));
        snapshot.forEach((docSnap) => {
          values[docSnap.id] = docSnap.data() as ThresholdValues;
        });
        if (Object.keys(values).length > 0) {
          setServerRows(new Map(Object.entries(values)));
        }
      } catch (error: unknown) {
        logger.error('Error loading shared threshold', error, {
          component: 'ThresholdContext',
          operation: 'threshold.loadFailed',
        });
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
    const collectionRef = collection(db, 'industryThresholds');
    const unsubscribe = onSnapshot(
      collectionRef,
      (snapshot) => {
        // Skip during initial load
        if (isInitialLoadRef.current) {
          return;
        }
        
        // Ignore our own pending writes
        if (snapshot.metadata.hasPendingWrites) {
          return;
        }
        
        if (snapshot.empty) {
          setServerRows(new Map());
          return;
        }

        setServerRows((prev) => {
          const next = new Map(prev);
          let hasChanges = false;

          snapshot.forEach((docSnap) => {
            const industryKey = docSnap.id;
            const remoteThreshold = docSnap.data() as ThresholdValues;
            const prevRow = next.get(industryKey) || {
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

            const merged: ThresholdValues = { ...prevRow, ...remoteThreshold };

            const fields: Array<keyof ThresholdValues> = [
              'irr', 'leverageF2Min', 'leverageF2Max', 'ro40Min', 'ro40Max',
              'cashSdebtMin', 'cashSdebtMax', 'currentRatioMin', 'currentRatioMax'
            ];

            for (const field of fields) {
              const dk = `${industryKey}.${field}`;
              if (dirtyKeysRef.current.has(dk)) {
                merged[field] = prevRow[field];
              }
            }

            next.set(industryKey, merged);
            hasChanges = true;
          });

          if (hasChanges) {
            return next;
          }
          return prev;
        });
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

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await Promise.all(
          Array.from(currentState.entries()).map(([industryKey, entry]) =>
            setDoc(doc(db, 'industryThresholds', industryKey), entry, { merge: true })
          )
        );
        dirtyKeysRef.current.clear();
        setDraft({});
      } catch (error: unknown) {
        logger.error('Error saving shared threshold to Firestore', error, {
          component: 'ThresholdContext',
          operation: 'threshold.saveFailed',
        });
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
          operation: 'threshold.setFieldValueDenied',
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
        await setDoc(doc(db, 'industryThresholds', industry), updated, { merge: true });
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
        logger.error('Error committing field to Firestore', error, {
          component: 'ThresholdContext',
          operation: 'threshold.saveFailed',
        });
      }
    },
    [draft, serverRows, currentUser, userRole]
  );

  const initializeFromData = useCallback((data: IndustryThresholdData[]) => {
    setServerRows((prev) => {
      const newMap = new Map(prev);
      data.forEach((item) => {
        const key = item.industryKey || item.industry;
        if (!newMap.has(key)) {
          newMap.set(key, {
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
