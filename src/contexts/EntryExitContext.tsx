import { createContext, useContext, ReactNode, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { EntryExitData } from '../types/stock';
import { useAuth } from './AuthContext';
import { saveEntryExitValues, loadEntryExitValues } from '../services/userDataService';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { isObject, isNumber, isString, isNullOrUndefined } from '../utils/typeGuards';
import { logger } from '../utils/logger';
import { validateEntryExitValue } from '../utils/inputValidator';

export interface EntryExitValues {
  entry1: number;
  entry2: number;
  exit1: number;
  exit2: number;
  currency: string;
  dateOfUpdate: string | null;
}

interface EntryExitContextType {
  getEntryExitValue: (ticker: string, companyName: string) => EntryExitValues | undefined;
  getFieldValue: (ticker: string, companyName: string, field: keyof EntryExitValues) => number | string | null;
  setFieldValue: (ticker: string, companyName: string, field: keyof EntryExitValues, value: number | string | null) => void;
  commitField: (ticker: string, companyName: string, field: keyof EntryExitValues) => Promise<void>;
  initializeFromData: (data: EntryExitData[]) => void;
  entryExitValues: Map<string, EntryExitValues>; // Computed for backward compatibility
}

export const EntryExitContext = createContext<EntryExitContextType | undefined>(undefined);

const STORAGE_KEY = 'entryExitValues';

// Type guard for EntryExitValues
function isEntryExitValues(value: unknown): value is EntryExitValues {
  if (!isObject(value)) {
    return false;
  }
  
  const obj = value as Record<string, unknown>;
  
  // Check required numeric fields
  if (!isNumber(obj.entry1) || !isNumber(obj.entry2) || 
      !isNumber(obj.exit1) || !isNumber(obj.exit2)) {
    return false;
  }
  
  // Check required string field
  if (!isString(obj.currency)) {
    return false;
  }
  
  // Check optional dateOfUpdate field (can be null or string)
  if (!isNullOrUndefined(obj.dateOfUpdate) && !isString(obj.dateOfUpdate)) {
    return false;
  }
  
  return true;
}

// Load from localStorage (fallback)
const loadFromStorage = (): Map<string, EntryExitValues> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return new Map(Object.entries(parsed));
    }
  } catch (error: unknown) {
    logger.error('Error loading EntryExit values from localStorage', error, { component: 'EntryExitContext', operation: 'loadFromLocalStorage' });
  }
  return new Map();
};

// Save to localStorage (fallback)
const saveToStorage = (values: Map<string, EntryExitValues>) => {
  try {
    const obj = Object.fromEntries(values);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch (error: unknown) {
    logger.error('Error saving EntryExit values to localStorage', error, { component: 'EntryExitContext', operation: 'saveToLocalStorage' });
  }
};

interface EntryExitProviderProps {
  children: ReactNode;
}

export function EntryExitProvider({ children }: EntryExitProviderProps) {
  const { currentUser } = useAuth();
  // serverRows: source of truth from Firestore
  const [serverRows, setServerRows] = useState<Map<string, EntryExitValues>>(() => loadFromStorage());
  // draft: only fields user is currently editing (e.g. "AAPL-Apple Inc..entry1": 123)
  const [draft, setDraft] = useState<Record<string, number | string | null>>({});
  const [isLoading, setIsLoading] = useState(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dirtyKeysRef = useRef<Set<string>>(new Set()); // Set of "ticker-companyName.field" that are being edited
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
        const loaded = await loadEntryExitValues(currentUser);
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
        logger.error('Error loading EntryExit values', error, { component: 'EntryExitContext', operation: 'loadEntryExitValues' });
        // Fallback to localStorage
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
    const docRef = doc(db, 'sharedData', 'entryExit');
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
            for (const [key, remoteValue] of Object.entries(remoteValues)) {
              if (!isEntryExitValues(remoteValue)) {
                logger.warn(`Invalid EntryExitValues format for key ${key}`, { component: 'EntryExitContext', operation: 'loadEntryExitValues', key, remoteValue });
                continue;
              }
              const remoteEntry = remoteValue;
              const prevRow = next.get(key) || { entry1: 0, entry2: 0, exit1: 0, exit2: 0, currency: 'USD', dateOfUpdate: null };
              
              // Merge remote into existing
              const merged: EntryExitValues = { ...prevRow, ...remoteEntry };
              
              // Keep local edits while editing (dirty fields should not be overwritten)
              const fields: Array<keyof EntryExitValues> = ['entry1', 'entry2', 'exit1', 'exit2', 'currency', 'dateOfUpdate'];
              for (const field of fields) {
                const dk = `${key}.${field}`;
                if (dirtyKeysRef.current.has(dk)) {
                  // This field is being edited, keep the local value
                  // Type assertion is safe here because prevRow and merged have the same structure
                  (merged as Record<keyof EntryExitValues, number | string | null>)[field] = prevRow[field];
                }
              }
              
              next.set(key, merged);
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
        logger.error('Error listening to EntryExit values', error, { component: 'EntryExitContext', operation: 'listenToEntryExitValues' });
      }
    );

    return () => {
      unsubscribe();
    };
  }, [currentUser?.uid]); // Removed isLoading from dependencies - listener should only recreate when user changes

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
      const [key, field] = draftKey.split('.');
      const entry = currentState.get(key) || { entry1: 0, entry2: 0, exit1: 0, exit2: 0, currency: 'USD', dateOfUpdate: null };
      // Type assertion is safe here because field comes from our own draft keys which are validated
      const updated: EntryExitValues = { ...entry, [field as keyof EntryExitValues]: draftValue as number | string | null };
      
      // Update dateOfUpdate if needed
      const allEmpty = updated.entry1 === 0 && updated.entry2 === 0 && updated.exit1 === 0 && updated.exit2 === 0;
      if (allEmpty) {
        updated.dateOfUpdate = null;
      } else if (!updated.dateOfUpdate) {
        const currentDate = new Date().toLocaleString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit' });
        updated.dateOfUpdate = currentDate;
      }
      
      currentState.set(key, updated);
    }

    // Save to localStorage immediately (fast fallback)
    saveToStorage(currentState);

    // Debounce Firestore save to avoid too many writes
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const obj = Object.fromEntries(currentState);
        await saveEntryExitValues(currentUser, obj);
        // After successful save, release dirty locks + remove draft
        dirtyKeysRef.current.clear();
        setDraft({});
      } catch (error: unknown) {
        logger.error('Error saving EntryExit values to Firestore', error, { component: 'EntryExitContext', operation: 'saveEntryExitValues' });
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
  const getFieldValue = useCallback((ticker: string, companyName: string, field: keyof EntryExitValues): number | string | null => {
    const key = `${ticker}-${companyName}`;
    const dk = `${key}.${field}`;
    
    // If draft exists, return draft value
    if (dk in draft) {
      return draft[dk];
    }
    
    // Otherwise return server value
    const serverEntry = serverRows.get(key);
    if (field === 'dateOfUpdate') return serverEntry?.[field] ?? null;
    if (field === 'currency') return serverEntry?.[field] ?? 'USD';
    return serverEntry?.[field] ?? 0;
  }, [serverRows, draft]);

  // Backward compatibility: get full EntryExitValues object
  const getEntryExitValue = useCallback((ticker: string, companyName: string): EntryExitValues | undefined => {
    const key = `${ticker}-${companyName}`;
    const serverEntry = serverRows.get(key);
    
    if (!serverEntry) {
      return undefined;
    }
    
    // Build result from server entry, but replace with draft values if they exist
    const result: EntryExitValues = { ...serverEntry };
    const fields: Array<keyof EntryExitValues> = ['entry1', 'entry2', 'exit1', 'exit2', 'currency', 'dateOfUpdate'];
    
    for (const field of fields) {
      const dk = `${key}.${field}`;
      if (dk in draft) {
        const draftValue = draft[dk];
        // Type-safe assignment with runtime checks
        if (field === 'currency' && typeof draftValue === 'string') {
          result.currency = draftValue;
        } else if (field === 'dateOfUpdate' && (typeof draftValue === 'string' || draftValue === null)) {
          result.dateOfUpdate = draftValue;
        } else if ((field === 'entry1' || field === 'entry2' || field === 'exit1' || field === 'exit2') && typeof draftValue === 'number') {
          // Type assertion is safe here because we've verified the field type and value type match
          (result as Record<'entry1' | 'entry2' | 'exit1' | 'exit2', number>)[field] = draftValue;
        }
      }
    }
    
    return result;
  }, [serverRows, draft]);

  // While typing: mark dirty + update draft (and optionally optimistic update serverRows)
  const setFieldValue = useCallback((ticker: string, companyName: string, field: keyof EntryExitValues, value: number | string | null) => {
    // Validate the value before setting
    const validation = validateEntryExitValue(field, value);
    if (!validation.isValid) {
      logger.warn('Invalid EntryExit value rejected', {
        component: 'EntryExitContext',
        operation: 'setFieldValue',
        field,
        value,
        error: validation.error,
      });
      // Still allow the change for UI responsiveness, but log the warning
      // The UI component will show the validation error
    }

    const key = `${ticker}-${companyName}`;
    const dk = `${key}.${field}`;
    
    // Mark as dirty and update draft
    dirtyKeysRef.current.add(dk);
    setDraft((d) => ({ ...d, [dk]: value }));
    
    // Optional optimistic UI update (keeps tables consistent)
    setServerRows((rows) => {
      const newRows = new Map(rows);
      const current = newRows.get(key) || { entry1: 0, entry2: 0, exit1: 0, exit2: 0, currency: 'USD', dateOfUpdate: null };
      const updated: EntryExitValues = { ...current, [field]: value };
      
      // Update dateOfUpdate if needed
      const allEmpty = updated.entry1 === 0 && updated.entry2 === 0 && updated.exit1 === 0 && updated.exit2 === 0;
      if (allEmpty) {
        updated.dateOfUpdate = null;
      } else if (!updated.dateOfUpdate && field !== 'dateOfUpdate') {
        const currentDate = new Date().toLocaleString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit' });
        updated.dateOfUpdate = currentDate;
      }
      
      newRows.set(key, updated);
      return newRows;
    });
  }, []);

  // Commit to Firestore on blur/enter, then release dirty lock
  const commitField = useCallback(async (ticker: string, companyName: string, field: keyof EntryExitValues) => {
    const key = `${ticker}-${companyName}`;
    const dk = `${key}.${field}`;
    const value = draft[dk];
    
    if (value === undefined) return;

    // Validate before committing to Firestore
    const validation = validateEntryExitValue(field, value);
    if (!validation.isValid) {
      logger.warn('Cannot commit invalid EntryExit value', {
        component: 'EntryExitContext',
        operation: 'commitField',
        field,
        value,
        error: validation.error,
      });
      // Don't commit invalid values
      return;
    }

    // Build the full entry to save
    const serverEntry = serverRows.get(key) || { entry1: 0, entry2: 0, exit1: 0, exit2: 0, currency: 'USD', dateOfUpdate: null };
    const updated: EntryExitValues = { ...serverEntry, [field]: value };
    
    // Validate the complete entry
    const entryValidation = Object.entries(updated).every(([f, v]) => {
      const fieldValidation = validateEntryExitValue(f as keyof EntryExitValues, v);
      return fieldValidation.isValid;
    });

    if (!entryValidation) {
      logger.warn('Cannot commit EntryExit entry with invalid values', {
        component: 'EntryExitContext',
        operation: 'commitField',
        key,
        updated,
      });
      return;
    }
    
    // Update dateOfUpdate if needed
    const allEmpty = updated.entry1 === 0 && updated.entry2 === 0 && updated.exit1 === 0 && updated.exit2 === 0;
    if (allEmpty) {
      updated.dateOfUpdate = null;
    } else if (!updated.dateOfUpdate && field !== 'dateOfUpdate') {
      const currentDate = new Date().toLocaleString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit' });
      updated.dateOfUpdate = currentDate;
    }

    try {
      // Save this specific field immediately
      const allValues = Object.fromEntries(serverRows);
      allValues[key] = updated;
      await saveEntryExitValues(currentUser, allValues);
      
      // Release lock + remove draft
      dirtyKeysRef.current.delete(dk);
      setDraft((d) => {
        const { [dk]: _, ...rest } = d;
        return rest;
      });
      
      // Update serverRows with committed value
      setServerRows((rows) => {
        const newRows = new Map(rows);
        newRows.set(key, updated);
        return newRows;
      });
    } catch (error: unknown) {
      logger.error('Error committing field to Firestore', error, { component: 'EntryExitContext', operation: 'commitField' });
    }
  }, [draft, serverRows, currentUser]);

  const initializeFromData = useCallback((data: EntryExitData[]) => {
    setServerRows((prev) => {
      const newMap = new Map(prev);
      data.forEach((item) => {
        const key = `${item.ticker}-${item.companyName}`;
        // Only initialize if key doesn't exist (preserve manually entered values)
        if (!newMap.has(key)) {
          newMap.set(key, {
            entry1: item.entry1 || 0,
            entry2: item.entry2 || 0,
            exit1: item.exit1 || 0,
            exit2: item.exit2 || 0,
            currency: item.currency || 'USD',
            dateOfUpdate: item.dateOfUpdate || null,
          });
        }
      });
      return newMap;
    });
  }, []);

  // Compute entryExitValues from serverRows + draft for backward compatibility
  const entryExitValues = useMemo(() => {
    const result = new Map(serverRows);
    for (const [draftKey, draftValue] of Object.entries(draft)) {
      const [key, field] = draftKey.split('.');
      const entry = result.get(key) || { entry1: 0, entry2: 0, exit1: 0, exit2: 0, currency: 'USD', dateOfUpdate: null };
      result.set(key, { ...entry, [field]: draftValue });
    }
    return result;
  }, [serverRows, draft]);

  const value: EntryExitContextType = {
    getEntryExitValue,
    getFieldValue,
    setFieldValue,
    commitField,
    initializeFromData,
    entryExitValues,
  };

  return <EntryExitContext.Provider value={value}>{children}</EntryExitContext.Provider>;
}

export function useEntryExitValues(): EntryExitContextType {
  const context = useContext(EntryExitContext);
  if (context === undefined) {
    throw new Error('useEntryExitValues must be used within an EntryExitProvider');
  }
  return context;
}
