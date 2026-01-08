import { createContext, useContext, ReactNode, useState, useCallback, useEffect, useRef } from 'react';
import { EntryExitData } from '../types/stock';
import { useAuth } from './AuthContext';
import { saveEntryExitValues, loadEntryExitValues } from '../services/userDataService';

export interface EntryExitValues {
  entry1: number;
  entry2: number;
  exit1: number;
  exit2: number;
  dateOfUpdate: string | null;
}

interface EntryExitContextType {
  getEntryExitValue: (ticker: string, companyName: string) => EntryExitValues | undefined;
  setEntryExitValue: (ticker: string, companyName: string, values: Partial<EntryExitValues>) => void;
  initializeFromData: (data: EntryExitData[]) => void;
  entryExitValues: Map<string, EntryExitValues>;
}

export const EntryExitContext = createContext<EntryExitContextType | undefined>(undefined);

const STORAGE_KEY = 'entryExitValues';

// Load from localStorage (fallback)
const loadFromStorage = (): Map<string, EntryExitValues> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return new Map(Object.entries(parsed));
    }
  } catch (error) {
    console.error('Error loading EntryExit values from localStorage:', error);
  }
  return new Map();
};

// Save to localStorage (fallback)
const saveToStorage = (values: Map<string, EntryExitValues>) => {
  try {
    const obj = Object.fromEntries(values);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch (error) {
    console.error('Error saving EntryExit values to localStorage:', error);
  }
};

interface EntryExitProviderProps {
  children: ReactNode;
}

export function EntryExitProvider({ children }: EntryExitProviderProps) {
  const { currentUser } = useAuth();
  const [entryExitValues, setEntryExitValues] = useState<Map<string, EntryExitValues>>(() => loadFromStorage());
  const [isLoading, setIsLoading] = useState(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load data from Firestore when user logs in or component mounts
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const loaded = await loadEntryExitValues(currentUser);
        if (loaded) {
          setEntryExitValues(new Map(Object.entries(loaded)));
        } else {
          // If no Firestore data, try localStorage
          const localData = loadFromStorage();
          if (localData.size > 0) {
            setEntryExitValues(localData);
          }
        }
      } catch (error) {
        console.error('Error loading EntryExit values:', error);
        // Fallback to localStorage
        const localData = loadFromStorage();
        if (localData.size > 0) {
          setEntryExitValues(localData);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [currentUser?.uid]); // Reload when user changes

  // Save to Firestore whenever entryExitValues changes (debounced)
  useEffect(() => {
    if (isLoading) return; // Don't save during initial load

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Save to localStorage immediately (fast fallback)
    saveToStorage(entryExitValues);

    // Debounce Firestore save to avoid too many writes
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const obj = Object.fromEntries(entryExitValues);
        await saveEntryExitValues(currentUser, obj);
      } catch (error) {
        console.error('Error saving EntryExit values to Firestore:', error);
      }
    }, 1000); // Wait 1 second after last change

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [entryExitValues, currentUser, isLoading]);

  const getEntryExitValue = useCallback((ticker: string, companyName: string): EntryExitValues | undefined => {
    const key = `${ticker}-${companyName}`;
    return entryExitValues.get(key);
  }, [entryExitValues]);

  const setEntryExitValue = useCallback((ticker: string, companyName: string, values: Partial<EntryExitValues>) => {
    const key = `${ticker}-${companyName}`;
    setEntryExitValues((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(key) || { entry1: 0, entry2: 0, exit1: 0, exit2: 0, dateOfUpdate: null };
      
      const updated: EntryExitValues = {
        ...current,
        ...values,
      };
      
      // Kontrollera om alla fält är 0/tomma
      const allEmpty = updated.entry1 === 0 && updated.entry2 === 0 && updated.exit1 === 0 && updated.exit2 === 0;
      
      // Uppdatera dateOfUpdate baserat på om alla fält är tomma
      if (allEmpty) {
        updated.dateOfUpdate = null;
      } else if (!updated.dateOfUpdate) {
        const currentDate = new Date().toLocaleString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit' });
        updated.dateOfUpdate = currentDate;
      }
      
      newMap.set(key, updated);
      return newMap;
    });
  }, []);

  const initializeFromData = useCallback((data: EntryExitData[]) => {
    setEntryExitValues((prev) => {
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
            dateOfUpdate: item.dateOfUpdate || null,
          });
        }
      });
      return newMap;
    });
  }, []);

  const value: EntryExitContextType = {
    getEntryExitValue,
    setEntryExitValue,
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

