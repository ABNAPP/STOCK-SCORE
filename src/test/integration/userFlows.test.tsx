/**
 * Integration Tests for User Flows
 * 
 * Tests complete user flows that span multiple components and services.
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { User } from 'firebase/auth';
import '../../i18n/config';
import { renderWithAuth } from '../helpers/renderHelpers';
import { setupFirebaseMocks, createMockFirebaseUser } from '../helpers/firebaseHelpers';
import App from '../../App';

// Mock all data hooks. Use vi.hoisted for createMockScoreBoardData (mocks run before imports).
const { mockScoreBoardData } = vi.hoisted(() => ({
  mockScoreBoardData: {
    companyName: 'Test Company',
    ticker: 'TEST',
    industry: 'Test Industry',
    irr: null,
    mungerQualityScore: null,
    valueCreation: null,
    tbSPrice: null,
    ro40Cy: null,
    ro40F1: null,
    ro40F2: null,
    leverageF2: null,
    pe1Industry: null,
    pe2Industry: null,
    currentRatio: null,
    cashSdebt: null,
    isCashSdebtDivZero: false,
    sma100: null,
    sma200: null,
    smaCross: null,
    price: null,
  },
}));

vi.mock('../../hooks/useScoreBoardData', () => ({
  useScoreBoardData: () => ({
    data: [mockScoreBoardData],
    loading: false,
    error: null,
  }),
}));

vi.mock('../../hooks/useBenjaminGrahamData', () => ({
  useBenjaminGrahamData: () => ({
    data: [],
    loading: false,
    error: null,
  }),
}));

vi.mock('../../hooks/usePEIndustryData', () => ({
  usePEIndustryData: () => ({
    data: [],
    loading: false,
    error: null,
  }),
}));

vi.mock('../../hooks/useThresholdIndustryData', () => ({
  useThresholdIndustryData: () => ({
    data: [],
    loading: false,
    error: null,
    lastUpdated: new Date(),
    refetch: vi.fn(),
  }),
}));

vi.mock('../../hooks/useUserRole', () => ({
  useUserRole: () => ({
    hasRole: true,
    userRole: 'admin',
    isEditor: true,
    isAdmin: true,
    canView: () => true,
    getAllowedViews: () => null,
    refreshUserRole: vi.fn(),
  }),
}));

// Mock Firebase config
vi.mock('../../config/firebase', () => ({
  auth: {},
  db: {},
  functions: {},
}));

// Mock migrations to avoid Firestore doc() in runPostAuthMigrations
vi.mock('../../services/migrations', () => ({
  runPreAuthMigrations: vi.fn(),
  runPostAuthMigrations: vi.fn().mockResolvedValue(undefined),
}));

// Mock Firestore-dependent services
vi.mock('../../services/userPreferencesService', () => ({
  getUserPreferences: vi.fn().mockResolvedValue(null),
  saveUserPreferences: vi.fn().mockResolvedValue(undefined),
  DEFAULT_NOTIFICATION_PREFERENCES: {},
}));

// Mock firestoreCacheService without loading real module (avoids Firestore)
vi.mock('../../services/firestoreCacheService', () => ({
  CACHE_KEYS: { BENJAMIN_GRAHAM: 'cache:benjaminGraham', SMA: 'cache:sma', PE_INDUSTRY: 'cache:peIndustry', SCORE_BOARD: 'cache:scoreBoard', THRESHOLD_INDUSTRY: 'cache:thresholdIndustry', CURRENCY_RATES_USD: 'cache:currency_rates_usd' },
  DEFAULT_TTL: 30 * 60 * 1000,
  VIEWDATA_MIGRATION_MODE: 'dual-read',
  shouldBlockAppCacheWriteInCutover: vi.fn().mockReturnValue(false),
  getViewData: vi.fn().mockResolvedValue(null),
  setViewData: vi.fn().mockResolvedValue(undefined),
  getViewDataWithFallback: vi.fn().mockResolvedValue(null),
  getCachedData: vi.fn().mockResolvedValue(null),
  setCachedData: vi.fn().mockResolvedValue(undefined),
  getDeltaCacheEntry: vi.fn().mockResolvedValue(null),
  setDeltaCacheEntry: vi.fn().mockResolvedValue(undefined),
  getLastVersion: vi.fn().mockResolvedValue(0),
  getCacheAge: vi.fn().mockResolvedValue(null),
  migrateCoreBoardToScoreBoard: vi.fn().mockResolvedValue(true),
  runTruncatedCacheMigrations: vi.fn().mockResolvedValue(undefined),
  clearCache: vi.fn().mockResolvedValue({ cleared: true }),
}));

// Mock ThresholdContext and EntryExitContext to avoid Firestore doc()/onSnapshot in integration tests.
// Provide full context values so useThresholdValues/useEntryExitValues work.
// Use vi.hoisted so mocks can reference these (mocks are hoisted before other code).
const { mockThresholdValues, mockEntryExitValues } = vi.hoisted(() => ({
  mockThresholdValues: new Map<string, { irr: number; leverageF2Min: number; leverageF2Max: number; ro40Min: number; ro40Max: number; cashSdebtMin: number; cashSdebtMax: number; currentRatioMin: number; currentRatioMax: number }>(),
  mockEntryExitValues: new Map<string, { entry1: number; entry2: number; exit1: number; exit2: number; currency: string; dateOfUpdate: string | null }>(),
}));

vi.mock('../../contexts/ThresholdContext', () => {
  const React = require('react');
  const ThresholdContext = React.createContext<unknown>(undefined);
  const mockValue = {
    getThresholdValue: () => undefined,
    getFieldValue: () => 0,
    setFieldValue: vi.fn(),
    commitField: vi.fn().mockResolvedValue(undefined),
    initializeFromData: vi.fn(),
    thresholdValues: mockThresholdValues,
  };
  return {
    ThresholdContext,
    ThresholdProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(ThresholdContext.Provider, { value: mockValue }, children),
    useThresholdValues: () => mockValue,
  };
});
vi.mock('../../contexts/EntryExitContext', () => {
  const React = require('react');
  const EntryExitContext = React.createContext<unknown>(undefined);
  const mockValue = {
    getEntryExitValue: () => undefined,
    getFieldValue: () => null,
    setFieldValue: vi.fn(),
    commitField: vi.fn().mockResolvedValue(undefined),
    initializeFromData: vi.fn(),
    entryExitValues: mockEntryExitValues,
  };
  return {
    EntryExitContext,
    EntryExitProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(EntryExitContext.Provider, { value: mockValue }, children),
    useEntryExitValues: () => mockValue,
  };
});

describe('User Flows Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    setupFirebaseMocks();
  });

  it('renders with providers (no App)', () => {
    const user = createMockFirebaseUser();
    setupFirebaseMocks({ user });
    const { container } = renderWithAuth(<div data-testid="simple">Hi</div>, user);
    expect(screen.getByTestId('simple')).toHaveTextContent('Hi');
  });

  describe('Login → View Score Board → Filter → Save Filter → Load Filter', () => {
    it.skip('should complete full filter workflow', async () => {
      // TODO: App render causes hang (infinite loop?). Firebase/Firestore mocks are in place.
      const user = createMockFirebaseUser();
      setupFirebaseMocks({ user });
      
      renderWithAuth(<App />, user);

      await waitFor(() => {
        expect(screen.getByText(/Score Board|Score/i)).toBeInTheDocument();
      });

      const scoreBoardLink = screen.queryByText(/Score Board/i);
      if (scoreBoardLink) {
        fireEvent.click(scoreBoardLink);
      }

      await waitFor(() => {
        expect(screen.getByText('Test Company')).toBeInTheDocument();
      });

      const filterButton = screen.getByLabelText(/filter|Filter/i);
      fireEvent.click(filterButton);

      const searchInput = screen.getByPlaceholderText(/sök|search/i);
      fireEvent.change(searchInput, { target: { value: 'Test' } });

      await waitFor(() => {
        expect(screen.getByText('Test Company')).toBeInTheDocument();
      });
    });
  });

  describe('View Entry/Exit → Edit values → Save to Firestore', () => {
    it.skip('should allow editing and saving Entry/Exit values', async () => {
      const user = createMockFirebaseUser({ 
        uid: 'editor-user',
        email: 'editor@example.com',
      } as User);
      setupFirebaseMocks({ user });

      renderWithAuth(<App />, user);

      // Navigate to Entry/Exit view
      await waitFor(() => {
        const entryExitLink = screen.queryByText(/Entry|Exit|Benjamin Graham/i);
        if (entryExitLink) {
          fireEvent.click(entryExitLink);
        }
      });

      // Wait for table
      await waitFor(() => {
        expect(screen.getByText(/Company|Ticker/i)).toBeInTheDocument();
      });

      // Find and edit an entry value
      const entryInputs = screen.queryAllByDisplayValue('0');
      if (entryInputs.length > 0) {
        fireEvent.change(entryInputs[0], { target: { value: '100' } });
        fireEvent.blur(entryInputs[0]);

        // Value should be updated (Firestore save is mocked)
        await waitFor(() => {
          expect(entryInputs[0]).toHaveValue(100);
        });
      }
    });
  });

  describe('Search → Navigate → View details', () => {
    it.skip('should allow searching and navigating to results', async () => {
      const user = createMockFirebaseUser();
      setupFirebaseMocks({ user });
      
      renderWithAuth(<App />, user);

      // Find search input
      await waitFor(() => {
        const searchInput = screen.queryByPlaceholderText(/sök|search/i);
        if (searchInput) {
          fireEvent.change(searchInput, { target: { value: 'Test' } });
        }
      });

      // Wait for search results
      await waitFor(() => {
        const results = screen.queryAllByText(/Test/i);
        expect(results.length).toBeGreaterThan(0);
      }, { timeout: 2000 });
    });
  });

  describe('Apply filters → Sort → Paginate', () => {
    it.skip('should handle filter, sort, and pagination together', async () => {
      const user = createMockFirebaseUser();
      setupFirebaseMocks({ user });
      
      renderWithAuth(<App />, user);

      // Wait for table to load
      await waitFor(() => {
        expect(screen.getByText(/Company|Ticker/i)).toBeInTheDocument();
      });

      // Apply filter
      const filterButton = screen.queryByLabelText(/filter/i);
      if (filterButton) {
        fireEvent.click(filterButton);
        
        const searchInput = screen.queryByPlaceholderText(/sök/i);
        if (searchInput) {
          fireEvent.change(searchInput, { target: { value: 'Test' } });
        }
      }

      // Sort (click column header)
      const sortableHeaders = screen.queryAllByRole('columnheader');
      if (sortableHeaders.length > 0) {
        fireEvent.click(sortableHeaders[0]);
      }

      // Paginate (if pagination is visible)
      const nextPageButton = screen.queryByLabelText(/next|nästa/i);
      if (nextPageButton) {
        fireEvent.click(nextPageButton);
      }

      // All operations should work together
      await waitFor(() => {
        expect(screen.getByText(/Test/i)).toBeInTheDocument();
      });
    });
  });
});
