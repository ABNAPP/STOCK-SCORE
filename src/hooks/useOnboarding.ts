import { useState, useCallback, useEffect } from 'react';

const UX_NAMESPACE = 'stockScore:ux';
const APP_VERSION = 'v1'; // Bump to re-show onboarding on major version change

export function getStorageKey(uid: string | null): string {
  const userPart = uid || 'anon';
  return `${UX_NAMESPACE}:onboardingCompleted_${APP_VERSION}_${userPart}`;
}

const LEGACY_KEY = 'stockScoreOnboardingCompleted';

function migrateLegacyKey(uid: string | null): void {
  try {
    if (localStorage.getItem(LEGACY_KEY) === 'true') {
      const newKey = getStorageKey(uid);
      localStorage.setItem(newKey, 'true');
      localStorage.removeItem(LEGACY_KEY);
    }
  } catch {
    // ignore
  }
}

function getIsCompleted(uid: string | null): boolean {
  if (typeof window === 'undefined') return false;
  try {
    migrateLegacyKey(uid);
    const key = getStorageKey(uid);
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

export interface UseOnboardingResult {
  isCompleted: boolean;
  markCompleted: () => void;
  resetOnboarding: () => void;
  showOnboarding: () => void;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

/**
 * Hook for onboarding state. UX-only localStorage, namespaced.
 * Does not mix with data cache.
 */
export function useOnboarding(uid: string | null): UseOnboardingResult {
  const [isCompleted, setIsCompleted] = useState(() => getIsCompleted(uid));
  const [isOpen, setOpen] = useState(false);

  useEffect(() => {
    setIsCompleted(getIsCompleted(uid));
  }, [uid]);

  const markCompleted = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const key = getStorageKey(uid);
      localStorage.setItem(key, 'true');
      setIsCompleted(true);
      setOpen(false);
    } catch {
      // ignore
    }
  }, [uid]);

  const resetOnboarding = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const key = getStorageKey(uid);
      localStorage.removeItem(key);
      setIsCompleted(false);
      setOpen(true);
    } catch {
      // ignore
    }
  }, [uid]);

  const showOnboarding = useCallback(() => {
    setOpen(true);
  }, []);

  return {
    isCompleted,
    markCompleted,
    resetOnboarding,
    showOnboarding,
    isOpen,
    setOpen,
  };
}
