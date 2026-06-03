import { createContext, useContext, ReactNode, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { EntryExitData } from '../types/stock';
import { useAuth } from './AuthContext';
import { saveEntryExitValues, loadEntryExitValues } from '../services/userDataService';
import { isObject, isNumber, isString, isNullOrUndefined } from '../utils/typeGuards';
import { logger } from '../utils/logger';
import { validateEntryExitValue } from '../utils/inputValidator';
import type { EntryExitValuesForScore } from '../types/score';

export type EntryExitValues = EntryExitValuesForScore;

/** Poll interval aligned with value-insight-be entry-exit cache TTL. */
const ENTRY_EXIT_POLL_MS = 60_000;

interface EntryExitContextType {
  getEntryExitValue: (ticker: string, companyName: string) => EntryExitValues | undefined;
  getFieldValue: (ticker: string, companyName: string, field: keyof EntryExitValues) => number | string | null;
  setFieldValue: (ticker: string, companyName: string, field: keyof EntryExitValues, value: number | string | null) => void;
  commitField: (ticker: string, companyName: string, field: keyof EntryExitValues) => Promise<void>;
  initializeFromData: (data: EntryExitData[]) => void;
  entryExitValues: Map<string, EntryExitValues>;
}

export const EntryExitContext = createContext<EntryExitContextType | undefined>(undefined);

function isEntryExitValues(value: unknown): value is EntryExitValues {
  if (!isObject(value)) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (!isNumber(obj.entry1) || !isNumber(obj.entry2) || !isNumber(obj.exit1) || !isNumber(obj.exit2)) {
    return false;
  }

  if (obj.currency !== undefined && obj.currency !== null && !isString(obj.currency)) {
    return false;
  }

  if (!isNullOrUndefined(obj.dateOfUpdate) && !isString(obj.dateOfUpdate)) {
    return false;
  }

  return true;
}

function mergeLoadedEntryExit(
  loaded: Record<string, EntryExitValues>,
  prev: Map<string, EntryExitValues>,
  dirtyKeys: Set<string>
): Map<string, EntryExitValues> {
  const next = new Map<string, EntryExitValues>();
  const fields: Array<keyof EntryExitValues> = ['entry1', 'entry2', 'exit1', 'exit2', 'currency', 'dateOfUpdate'];

  for (const [companyName, row] of Object.entries(loaded)) {
    if (!isEntryExitValues(row)) continue;
    const prevRow = prev.get(companyName) || { entry1: 0, entry2: 0, exit1: 0, exit2: 0, currency: '', dateOfUpdate: null };
    const merged: EntryExitValues = { ...row };
    if (typeof merged.currency !== 'string') {
      merged.currency = '';
    }
    for (const field of fields) {
      const dk = `${companyName}.${field}`;
      if (dirtyKeys.has(dk)) {
        (merged as Record<keyof EntryExitValues, number | string | null>)[field] = prevRow[field];
      }
    }
    next.set(companyName, merged);
  }

  return next;
}

interface EntryExitProviderProps {
  children: ReactNode;
}

export function EntryExitProvider({ children }: EntryExitProviderProps) {
  const { currentUser } = useAuth();
  const [serverRows, setServerRows] = useState<Map<string, EntryExitValues>>(new Map());
  const [draft, setDraft] = useState<Record<string, number | string | null>>({});
  const [isLoading, setIsLoading] = useState(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dirtyKeysRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);

  const refreshFromApi = useCallback(async (options?: { showLoading?: boolean }) => {
    if (!currentUser) return;
    if (options?.showLoading) setIsLoading(true);
    try {
      const loaded = await loadEntryExitValues(currentUser);
      if (loaded) {
        setServerRows((prev) => mergeLoadedEntryExit(loaded, prev, dirtyKeysRef.current));
      }
    } catch (error: unknown) {
      logger.error('Error loading EntryExit values', error, {
        component: 'EntryExitContext',
        operation: 'loadEntryExitValues',
      });
    } finally {
      if (options?.showLoading) {
        setIsLoading(false);
        setTimeout(() => {
          isInitialLoadRef.current = false;
        }, 100);
      }
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      setServerRows(new Map());
      setIsLoading(false);
      isInitialLoadRef.current = false;
      return;
    }

    isInitialLoadRef.current = true;
    void refreshFromApi({ showLoading: true });

    const intervalId = window.setInterval(() => {
      if (isInitialLoadRef.current) return;
      void refreshFromApi();
    }, ENTRY_EXIT_POLL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [currentUser?.uid, refreshFromApi]);

  useEffect(() => {
    if (isLoading || !currentUser || Object.keys(draft).length === 0) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const currentState = new Map(serverRows);
    for (const [draftKey, draftValue] of Object.entries(draft)) {
      const [key, field] = draftKey.split('.');
      const entry = currentState.get(key) || { entry1: 0, entry2: 0, exit1: 0, exit2: 0, currency: '', dateOfUpdate: null };
      const updated: EntryExitValues = { ...entry, [field as keyof EntryExitValues]: draftValue as number | string | null };

      const allEmpty = updated.entry1 === 0 && updated.entry2 === 0 && updated.exit1 === 0 && updated.exit2 === 0;
      if (allEmpty) {
        updated.dateOfUpdate = null;
      } else if (!updated.dateOfUpdate) {
        const currentDate = new Date().toLocaleString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit' });
        updated.dateOfUpdate = currentDate;
      }

      currentState.set(key, updated);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const obj = Object.fromEntries(currentState);
        await saveEntryExitValues(currentUser, obj);
        dirtyKeysRef.current.clear();
        setDraft({});
      } catch (error: unknown) {
        logger.error('Error saving EntryExit values via API', error, {
          component: 'EntryExitContext',
          operation: 'saveEntryExitValues',
        });
      }
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [draft, serverRows, currentUser, isLoading]);

  const getFieldValue = useCallback(
    (_ticker: string, companyName: string, field: keyof EntryExitValues): number | string | null => {
      const key = companyName;
      const dk = `${key}.${field}`;

      if (dk in draft) {
        return draft[dk];
      }

      const serverEntry = serverRows.get(key);
      if (field === 'dateOfUpdate') return serverEntry?.[field] ?? null;
      if (field === 'currency') return serverEntry?.[field] ?? '';
      return serverEntry?.[field] ?? 0;
    },
    [serverRows, draft]
  );

  const getEntryExitValue = useCallback(
    (_ticker: string, companyName: string): EntryExitValues | undefined => {
      const key = companyName;
      const serverEntry = serverRows.get(key);

      if (!serverEntry) {
        return undefined;
      }

      const result: EntryExitValues = { ...serverEntry };
      const fields: Array<keyof EntryExitValues> = ['entry1', 'entry2', 'exit1', 'exit2', 'currency', 'dateOfUpdate'];

      for (const field of fields) {
        const dk = `${key}.${field}`;
        if (dk in draft) {
          const draftValue = draft[dk];
          if (field === 'currency' && typeof draftValue === 'string') {
            result.currency = draftValue;
          } else if (field === 'dateOfUpdate' && (typeof draftValue === 'string' || draftValue === null)) {
            result.dateOfUpdate = draftValue;
          } else if (
            (field === 'entry1' || field === 'entry2' || field === 'exit1' || field === 'exit2') &&
            typeof draftValue === 'number'
          ) {
            (result as Record<'entry1' | 'entry2' | 'exit1' | 'exit2', number>)[field] = draftValue;
          }
        }
      }

      return result;
    },
    [serverRows, draft]
  );

  const setFieldValue = useCallback(
    (_ticker: string, companyName: string, field: keyof EntryExitValues, value: number | string | null) => {
      const validation = validateEntryExitValue(field, value);
      if (!validation.isValid) {
        logger.warn('Invalid EntryExit value rejected', {
          component: 'EntryExitContext',
          operation: 'setFieldValue',
          field,
          value,
          error: validation.error,
        });
      }

      const key = companyName;
      const dk = `${key}.${field}`;

      dirtyKeysRef.current.add(dk);
      setDraft((d) => ({ ...d, [dk]: value }));

      setServerRows((rows) => {
        const newRows = new Map(rows);
        const current = newRows.get(key) || { entry1: 0, entry2: 0, exit1: 0, exit2: 0, currency: '', dateOfUpdate: null };
        const updated: EntryExitValues = { ...current, [field]: value };

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
    },
    []
  );

  const commitField = useCallback(
    async (_ticker: string, companyName: string, field: keyof EntryExitValues) => {
      const key = companyName;
      const dk = `${key}.${field}`;
      const value = draft[dk];

      if (value === undefined) return;

      const validation = validateEntryExitValue(field, value);
      if (!validation.isValid) {
        logger.warn('Cannot commit invalid EntryExit value', {
          component: 'EntryExitContext',
          operation: 'commitField',
          field,
          value,
          error: validation.error,
        });
        return;
      }

      const serverEntry = serverRows.get(key) || { entry1: 0, entry2: 0, exit1: 0, exit2: 0, currency: '', dateOfUpdate: null };
      const updated: EntryExitValues = { ...serverEntry, [field]: value };

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

      const allEmpty = updated.entry1 === 0 && updated.entry2 === 0 && updated.exit1 === 0 && updated.exit2 === 0;
      if (allEmpty) {
        updated.dateOfUpdate = null;
      } else if (!updated.dateOfUpdate && field !== 'dateOfUpdate') {
        const currentDate = new Date().toLocaleString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit' });
        updated.dateOfUpdate = currentDate;
      }

      try {
        const allValues = Object.fromEntries(serverRows);
        allValues[key] = updated;
        await saveEntryExitValues(currentUser, allValues);

        dirtyKeysRef.current.delete(dk);
        setDraft((d) => {
          const { [dk]: _, ...rest } = d;
          return rest;
        });

        setServerRows((rows) => {
          const newRows = new Map(rows);
          newRows.set(key, updated);
          return newRows;
        });
      } catch (error: unknown) {
        logger.error('Error committing field via API', error, {
          component: 'EntryExitContext',
          operation: 'commitField',
        });
      }
    },
    [draft, serverRows, currentUser]
  );

  const initializeFromData = useCallback((data: EntryExitData[]) => {
    setServerRows((prev) => {
      const newMap = new Map(prev);
      data.forEach((item) => {
        const key = item.companyName;
        if (!newMap.has(key)) {
          newMap.set(key, {
            entry1: item.entry1 || 0,
            entry2: item.entry2 || 0,
            exit1: item.exit1 || 0,
            exit2: item.exit2 || 0,
            currency: item.currency ?? '',
            dateOfUpdate: item.dateOfUpdate || null,
          });
        }
      });
      return newMap;
    });
  }, []);

  const entryExitValues = useMemo(() => {
    const result = new Map(serverRows);
    for (const [draftKey, draftValue] of Object.entries(draft)) {
      const [key, field] = draftKey.split('.');
      const entry = result.get(key) || { entry1: 0, entry2: 0, exit1: 0, exit2: 0, currency: '', dateOfUpdate: null };
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
