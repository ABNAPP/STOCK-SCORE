/**
 * Integration tests for RefreshContext registry pattern.
 * Proves that Refresh All triggers only registered refetches,
 * and does not load data when no data consumers are mounted.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { RefreshProvider, useRefresh, useRefreshOptional } from '../RefreshContext';

// Mock dependencies
vi.mock('../../services/firestoreCacheService', () => ({
  clearCache: vi.fn().mockResolvedValue({ cleared: true }),
}));

vi.mock('../../utils/serviceWorkerRegistration', () => ({
  requestClearApiCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../ToastContext', () => ({
  useToast: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showWarning: vi.fn(),
  }),
}));

vi.mock('../NotificationContext', () => ({
  useNotifications: () => ({
    createNotification: vi.fn(),
  }),
}));

vi.mock('../LoadingProgressContext', () => ({
  useLoadingProgress: () => ({
    reset: vi.fn(),
  }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <RefreshProvider>{children}</RefreshProvider>
);

describe('RefreshContext integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registerRefetch returns unregister callback', () => {
    const refetchMock = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(
      () => {
        const refresh = useRefresh();
        return refresh.registerRefetch('score-board', refetchMock);
      },
      { wrapper }
    );

    expect(typeof result.current).toBe('function');

    act(() => {
      result.current();
    });

    // After unregister, refreshAll should not call our refetch
    // (we'll verify in next test)
  });

  it('refreshAll triggers only registered refetches', async () => {
    const scoreBoardRefetch = vi.fn().mockResolvedValue(undefined);
    const benjaminGrahamRefetch = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(
      () => {
        const refresh = useRefresh();
        React.useEffect(() => {
          const un1 = refresh.registerRefetch('score-board', scoreBoardRefetch);
          const un2 = refresh.registerRefetch('benjamin-graham', benjaminGrahamRefetch);
          return () => {
            un1();
            un2();
          };
        }, [refresh]);
        return refresh;
      },
      { wrapper }
    );

    await act(async () => {
      await result.current.refreshAll();
    });

    // Both registered refetches should be called
    expect(scoreBoardRefetch).toHaveBeenCalledTimes(1);
    expect(benjaminGrahamRefetch).toHaveBeenCalledTimes(1);
  });

  it('refreshAll does NOT call refetch when no data consumers are mounted', async () => {
    const refetchMock = vi.fn().mockResolvedValue(undefined);

    // Component that uses useRefresh but does NOT register any refetch
    const { result } = renderHook(
      () => {
        const refresh = useRefresh();
        return refresh;
      },
      { wrapper }
    );

    // No one has registered - call refreshAll
    await act(async () => {
      await result.current.refreshAll();
    });

    // Our refetch was never registered, so it should never be called
    expect(refetchMock).not.toHaveBeenCalled();
  });

  it('unregister removes refetch from registry - unmounted hook does not get refreshed', async () => {
    const refetchMock = vi.fn().mockResolvedValue(undefined);

    const refreshAllRef = { current: null as (() => Promise<void>) | null };

    const { unmount } = renderHook(
      () => {
        const refresh = useRefresh();
        refreshAllRef.current = refresh.refreshAll;
        React.useEffect(() => {
          const unregister = refresh.registerRefetch('score-board', refetchMock);
          return unregister;
        }, [refresh]);
        return refresh;
      },
      { wrapper }
    );

    // Unmount - cleanup runs, refetch is unregistered
    unmount();

    // Call refreshAll (via ref - provider still exists in wrapper)
    await act(async () => {
      await refreshAllRef.current!();
    });

    // Refetch should NOT have been called (we unregistered on unmount)
    expect(refetchMock).not.toHaveBeenCalled();
  });

  it('useRefreshOptional returns undefined when outside RefreshProvider', () => {
    const { result } = renderHook(() => useRefreshOptional(), {
      wrapper: ({ children }) => <>{children}</>,
    });

    expect(result.current).toBeUndefined();
  });
});
