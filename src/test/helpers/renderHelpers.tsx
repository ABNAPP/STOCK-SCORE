/**
 * Render Helpers for Testing
 *
 * Provides utility functions for rendering React components in tests
 * with all necessary providers and contexts. Provider tree matches main.tsx + App.tsx:
 * Theme → Toast → Auth → Notification → LoadingProgress → Refresh → AutoRefresh → EntryExit → Threshold.
 */

import React, { ReactElement, useState, useEffect } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { AuthProvider, AuthContext, type AuthContextType } from '../../contexts/AuthContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { RefreshProvider } from '../../contexts/RefreshContext';
import { AutoRefreshProvider } from '../../contexts/AutoRefreshContext';
import { LoadingProgressProvider } from '../../contexts/LoadingProgressContext';
import { EntryExitProvider } from '../../contexts/EntryExitContext';
import { ThresholdProvider } from '../../contexts/ThresholdContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { ShareableHydrationProvider } from '../../contexts/ShareableHydrationContext';
import { User } from 'firebase/auth';
import { createMockFirebaseUser } from '../fixtures/mockFirebase';
import { vi } from 'vitest';
import type { ShareableLink } from '../../services/shareableLinkService';

export interface MockAuthOptions {
  role?: 'admin' | 'viewer' | null;
  allowedViews?: string[];
}

/** Auth override for setAuth: update role/allowedViews without re-rendering the whole tree. */
export interface SetAuthArg {
  role?: 'admin' | 'viewer' | null;
  allowedViews?: string[];
}

/** Build a stable mock auth value for tests so useAuth() returns the given user without Firebase. */
export function getMockAuthValue(
  user: User | null,
  options?: { userRole?: 'admin' | 'viewer' | null; allowedViews?: string[] }
): AuthContextType {
  const { userRole = null, allowedViews } = options ?? {};
  return {
    currentUser: user,
    userRole: userRole ?? null,
    viewerPermissions: allowedViews ? { allowedViews } : null,
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
  userRole?: 'admin' | 'viewer' | null;
  allowedViews?: string[];
  loadedShareableLink?: ShareableLink | null;
  initialPath?: string;
  useMemoryRouter?: boolean;
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

/** Router component - MemoryRouter for tests (deterministic), BrowserRouter for integration. */
const RouterWrapper = ({
  children,
  initialPath = '/',
  useMemoryRouter: useMem = true,
}: {
  children: React.ReactNode;
  initialPath?: string;
  useMemoryRouter?: boolean;
}) =>
  useMem ? (
    <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>
  ) : (
    <BrowserRouter>{children}</BrowserRouter>
  );

/**
 * Wrapper component with all providers (order matches main.tsx + App.tsx).
 * When options.user is provided, Auth is mocked with that user; otherwise AuthProvider is used.
 */
function AllTheProviders({
  children,
  user,
  userRole,
  allowedViews,
  loadedShareableLink = null,
  initialPath = '/',
  useMemoryRouter = true,
}: AllTheProvidersProps) {
  const authContent = <AuthAndBelow>{children}</AuthAndBelow>;
  const wrappedAuth = (
    <ShareableHydrationProvider link={loadedShareableLink} onConsume={() => {}}>
      {user !== undefined ? (
        <AuthContext.Provider value={getMockAuthValue(user, { userRole, allowedViews })}>
          {authContent}
        </AuthContext.Provider>
      ) : (
        <AuthProvider>{authContent}</AuthProvider>
      )}
    </ShareableHydrationProvider>
  );

  return (
    <RouterWrapper initialPath={initialPath} useMemoryRouter={useMemoryRouter}>
      <ThemeProvider>
        <ToastProvider>{wrappedAuth}</ToastProvider>
      </ThemeProvider>
    </RouterWrapper>
  );
}

/** Ref for setAuth when exposeSetAuth is true */
const setAuthRef: { current: ((auth: SetAuthArg) => void) | null } = { current: null };

/**
 * Wrapper that holds auth in state so setAuth can update it and trigger re-render.
 */
function AllTheProvidersWithAuthControl({
  children,
  user,
  userRole: initialUserRole,
  allowedViews: initialAllowedViews,
  loadedShareableLink = null,
  initialPath = '/',
  useMemoryRouter = true,
}: AllTheProvidersProps) {
  const [authOverride, setAuthOverride] = useState<SetAuthArg>({
    role: initialUserRole,
    allowedViews: initialAllowedViews,
  });
  useEffect(() => {
    setAuthRef.current = (auth: SetAuthArg) => setAuthOverride((prev) => ({ ...prev, ...auth }));
    return () => {
      setAuthRef.current = null;
    };
  }, []);
  const userRole = authOverride.role ?? initialUserRole;
  const allowedViews = authOverride.allowedViews ?? initialAllowedViews;
  return (
    <AllTheProviders
      user={user}
      userRole={userRole}
      allowedViews={allowedViews}
      loadedShareableLink={loadedShareableLink}
      initialPath={initialPath}
      useMemoryRouter={useMemoryRouter}
    >
      {children}
    </AllTheProviders>
  );
}

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  user?: User | null;
  userRole?: 'admin' | 'viewer' | null;
  allowedViews?: string[];
  loadedShareableLink?: ShareableLink | null;
  initialPath?: string;
  useMemoryRouter?: boolean;
  /** When true, return { ...result, setAuth } so tests can update auth without re-mounting. */
  exposeSetAuth?: boolean;
}

/**
 * Render component with all providers (renderWithAppProviders).
 * Alias: renderWithAppProviders for tests needing full provider tree.
 * When exposeSetAuth: true, returns { ...result, setAuth } for updating auth under test.
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: RenderWithProvidersOptions
) {
  const {
    user: userOpt,
    userRole,
    allowedViews,
    loadedShareableLink,
    initialPath = '/',
    useMemoryRouter = true,
    exposeSetAuth = false,
    ...renderOptions
  } = options || {};

  const user =
    userOpt ??
    (userRole !== undefined || allowedViews !== undefined || exposeSetAuth
      ? createMockFirebaseUser()
      : undefined);

  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    exposeSetAuth ? (
      <AllTheProvidersWithAuthControl
        user={user}
        userRole={userRole}
        allowedViews={allowedViews}
        loadedShareableLink={loadedShareableLink}
        initialPath={initialPath}
        useMemoryRouter={useMemoryRouter}
      >
        {children}
      </AllTheProvidersWithAuthControl>
    ) : (
      <AllTheProviders
        user={user}
        userRole={userRole}
        allowedViews={allowedViews}
        loadedShareableLink={loadedShareableLink}
        initialPath={initialPath}
        useMemoryRouter={useMemoryRouter}
      >
        {children}
      </AllTheProviders>
    );

  const result = render(ui, { wrapper: Wrapper, ...renderOptions });

  if (exposeSetAuth) {
    const setAuth = (auth: SetAuthArg) => {
      if (setAuthRef.current) setAuthRef.current(auth);
    };
    return { ...result, setAuth };
  }

  return result;
}

/** Alias for renderWithProviders - full app provider tree. */
export const renderWithAppProviders = renderWithProviders;

/**
 * Render component with mock authenticated user.
 * When userRole is 'admin', threshold/entry-exit editing is enabled.
 */
export function renderWithAuth(
  ui: ReactElement,
  user: User = createMockFirebaseUser(),
  options?: RenderWithProvidersOptions
) {
  const { userRole = 'admin', ...rest } = options || {};
  return renderWithProviders(ui, { ...rest, user, userRole });
}

/**
 * Render a view at the given path with optional auth and shareable link.
 * Pass the view component as first arg (or children via options).
 */
export function renderView(
  path: string,
  options?: {
    role?: 'admin' | 'viewer' | null;
    allowedViews?: string[];
    loadedShareableLink?: ShareableLink | null;
    children?: React.ReactNode;
  } & RenderWithProvidersOptions
) {
  const { role = 'admin', allowedViews, loadedShareableLink, children, ...rest } = options ?? {};
  const user = createMockFirebaseUser();
  return renderWithProviders(
    (children ?? <div data-testid="view-container" />) as ReactElement,
    {
      user,
      userRole: role,
      allowedViews,
      loadedShareableLink,
      initialPath: path.startsWith('/') ? path : `/${path}`,
      ...rest,
    }
  );
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
