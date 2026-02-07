/**
 * Render Helpers for Testing
 *
 * Provides utility functions for rendering React components in tests
 * with all necessary providers and contexts. Provider tree matches main.tsx + App.tsx:
 * Theme → Toast → Auth → Notification → LoadingProgress → Refresh → AutoRefresh → EntryExit → Threshold.
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { AuthProvider, AuthContext, type AuthContextType } from '../../contexts/AuthContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { RefreshProvider } from '../../contexts/RefreshContext';
import { AutoRefreshProvider } from '../../contexts/AutoRefreshContext';
import { LoadingProgressProvider } from '../../contexts/LoadingProgressContext';
import { EntryExitProvider } from '../../contexts/EntryExitContext';
import { ThresholdProvider } from '../../contexts/ThresholdContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { User } from 'firebase/auth';
import { createMockFirebaseUser } from '../fixtures/mockFirebase';
import { vi } from 'vitest';

/** Build a stable mock auth value for tests so useAuth() returns the given user without Firebase. */
function getMockAuthValue(user: User | null): AuthContextType {
  return {
    currentUser: user,
    userRole: null,
    viewerPermissions: null,
    loading: false,
    login: vi.fn().mockResolvedValue(undefined),
    signup: vi.fn().mockResolvedValue({ user } as { user: User }),
    logout: vi.fn().mockResolvedValue(undefined),
    refreshUserRole: vi.fn().mockResolvedValue(undefined),
  };
}

interface AllTheProvidersProps {
  children: React.ReactNode;
  user?: User | null;
}

/** Inner tree under Auth: matches App.tsx order (LoadingProgress → Refresh → AutoRefresh → …). */
function AuthAndBelow({ children }: { children: React.ReactNode }) {
  return (
    <NotificationProvider>
      <LoadingProgressProvider>
        <RefreshProvider>
          <AutoRefreshProvider>
            <EntryExitProvider>
              <ThresholdProvider>
                {children}
              </ThresholdProvider>
            </EntryExitProvider>
          </AutoRefreshProvider>
        </RefreshProvider>
      </LoadingProgressProvider>
    </NotificationProvider>
  );
}

/**
 * Wrapper component with all providers (order matches main.tsx + App.tsx).
 * When options.user is provided, Auth is mocked with that user; otherwise AuthProvider is used.
 */
function AllTheProviders({ children, user }: AllTheProvidersProps) {
  const authContent = <AuthAndBelow>{children}</AuthAndBelow>;

  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          {user !== undefined ? (
            <AuthContext.Provider value={getMockAuthValue(user)}>
              {authContent}
            </AuthContext.Provider>
          ) : (
            <AuthProvider>
              {authContent}
            </AuthProvider>
          )}
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

/**
 * Render component with all providers
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & { user?: User | null }
) {
  const { user, ...renderOptions } = options || {};
  
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <AllTheProviders user={user}>{children}</AllTheProviders>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

/**
 * Render component with mock authenticated user
 */
export function renderWithAuth(
  ui: ReactElement,
  user: User = createMockFirebaseUser(),
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return renderWithProviders(ui, { ...options, user });
}

/**
 * Wait for data to load in component
 */
export async function waitForDataLoad(
  queryFn: () => HTMLElement | null,
  options: { timeout?: number } = {}
): Promise<HTMLElement> {
  const { timeout = 5000 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const element = queryFn();
    if (element) {
      return element;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  throw new Error('Data did not load within timeout');
}
