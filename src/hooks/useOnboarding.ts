import { useState, useCallback } from 'react';

export function getStorageKey(_uid: string | null): string {
  return 'onboardingCompleted';
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
 * Hook for onboarding state. In-memory only (session state).
 */
export function useOnboarding(_uid: string | null): UseOnboardingResult {
  const [isCompleted, setIsCompleted] = useState(false);
  const [isOpen, setOpen] = useState(false);

  const markCompleted = useCallback(() => {
    setIsCompleted(true);
    setOpen(false);
  }, []);

  const resetOnboarding = useCallback(() => {
    setIsCompleted(false);
    setOpen(true);
  }, []);

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
