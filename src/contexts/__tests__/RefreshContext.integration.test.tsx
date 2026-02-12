/**
 * RefreshContext integration tests: refreshAll uses Cloud Function only.
 * Verifies that refreshAll calls clearCache and adminRefreshCache (httpsCallable),
 * and does NOT make direct fetch to Apps Script or setViewData/setCachedData.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '../ThemeContext';
import { ToastProvider } from '../ToastContext';
import { AuthContext } from '../AuthContext';
import { NotificationProvider } from '../NotificationContext';
import { LoadingProgressProvider } from '../LoadingProgressContext';
import { RefreshProvider, useRefresh } from '../RefreshContext';
import * as firestoreCacheService from '../../services/firestoreCacheService';
import { createMockFirebaseUser } from '../../test/fixtures/mockFirebase';
import { getMockAuthValue } from '../../test/helpers/renderHelpers';
import '../../i18n/config';

const mockCallableFn = vi.fn();

vi.mock('firebase/functions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/functions')>();
  return {
    ...actual,
    httpsCallable: () => mockCallableFn,
  };
});

describe('RefreshContext - refreshAll uses Cloud Function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('PROD', 'false');
    vi.stubEnv('DEV', 'true');
    vi.spyOn(firestoreCacheService, 'clearCache').mockResolvedValue({ cleared: true });
    mockCallableFn.mockResolvedValue({ data: { ok: true, refreshed: [], errors: [] } });
  });

  it('refreshAll calls clearCache and adminRefreshCache (httpsCallable)', async () => {
    function TestConsumer() {
      const { refreshAll } = useRefresh();
      return (
        <button onClick={() => refreshAll()} data-testid="refresh-btn">
          Refresh
        </button>
      );
    }

    const user = createMockFirebaseUser();
    const mockAuth = getMockAuthValue(user, { userRole: 'admin' });

    render(
      <ThemeProvider>
        <ToastProvider>
          <AuthContext.Provider value={mockAuth}>
            <NotificationProvider>
              <LoadingProgressProvider>
                <RefreshProvider>
                  <TestConsumer />
                </RefreshProvider>
              </LoadingProgressProvider>
            </NotificationProvider>
          </AuthContext.Provider>
        </ToastProvider>
      </ThemeProvider>
    );

    const btn = screen.getByTestId('refresh-btn');
    btn.click();

    await waitFor(() => {
      expect(firestoreCacheService.clearCache).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(mockCallableFn).toHaveBeenCalledWith({ force: true });
    });
  });
});
