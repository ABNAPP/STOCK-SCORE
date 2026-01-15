/**
 * Render Helpers for Testing
 * 
 * Provides utility functions for rendering React components in tests
 * with all necessary providers and contexts.
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { AuthProvider } from '../../contexts/AuthContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { RefreshProvider } from '../../contexts/RefreshContext';
import { AutoRefreshProvider } from '../../contexts/AutoRefreshContext';
import { LoadingProgressProvider } from '../../contexts/LoadingProgressContext';
import { EntryExitProvider } from '../../contexts/EntryExitContext';
import { ThresholdProvider } from '../../contexts/ThresholdContext';
import { User } from 'firebase/auth';
import { createMockFirebaseUser } from '../fixtures/mockFirebase';
import { act } from '@testing-library/react';

interface AllTheProvidersProps {
  children: React.ReactNode;
  user?: User | null;
}

/**
 * Wrapper component with all providers
 */
function AllTheProviders({ children, user = null }: AllTheProvidersProps) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <RefreshProvider>
            <AutoRefreshProvider>
              <LoadingProgressProvider>
                <EntryExitProvider>
                  <ThresholdProvider>
                    {children}
                  </ThresholdProvider>
                </EntryExitProvider>
              </LoadingProgressProvider>
            </AutoRefreshProvider>
          </RefreshProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
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
