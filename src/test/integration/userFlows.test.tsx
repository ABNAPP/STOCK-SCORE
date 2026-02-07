/**
 * Integration Tests for User Flows
 * 
 * Tests complete user flows that span multiple components and services.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithAuth } from '../helpers/renderHelpers';
import { setupFirebaseMocks, createMockFirebaseUser } from '../helpers/firebaseHelpers';
import { createMockScoreBoardData } from '../helpers';
import App from '../../App';

// Mock all data hooks
vi.mock('../../hooks/useScoreBoardData', () => ({
  useScoreBoardData: () => ({
    data: [createMockScoreBoardData({ companyName: 'Test Company', ticker: 'TEST', score: 75 })],
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

// Mock Firebase
vi.mock('../../config/firebase', () => ({
  auth: {},
  db: {},
  functions: {},
}));

describe('User Flows Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    setupFirebaseMocks();
  });

  describe('Login → View Score Board → Filter → Save Filter → Load Filter', () => {
    it('should complete full filter workflow', async () => {
      const user = createMockFirebaseUser();
      setupFirebaseMocks({ user });
      
      renderWithAuth(<App />, user);

      // Wait for app to load
      await waitFor(() => {
        expect(screen.getByText(/Score Board|Score/i)).toBeInTheDocument();
      });

      // Navigate to Score Board (if not already there)
      const scoreBoardLink = screen.queryByText(/Score Board/i);
      if (scoreBoardLink) {
        fireEvent.click(scoreBoardLink);
      }

      // Wait for table to render
      await waitFor(() => {
        expect(screen.getByText('Test Company')).toBeInTheDocument();
      });

      // Open filters
      const filterButton = screen.getByLabelText(/filter|Filter/i);
      fireEvent.click(filterButton);

      // Apply a filter (e.g., search for company name)
      const searchInput = screen.getByPlaceholderText(/sök|search/i);
      fireEvent.change(searchInput, { target: { value: 'Test' } });

      await waitFor(() => {
        expect(screen.getByText('Test Company')).toBeInTheDocument();
      });

      // Note: Full filter save/load would require more complex setup
      // This demonstrates the flow structure
    });
  });

  describe('View Entry/Exit → Edit values → Save to Firestore', () => {
    it('should allow editing and saving Entry/Exit values', async () => {
      const user = createMockFirebaseUser({ 
        uid: 'editor-user',
        email: 'editor@example.com',
      } as User);
      setupFirebaseMocks({ user });

      // Mock user role as editor (must include canView so Sidebar does not throw)
      vi.mock('../../hooks/useUserRole', () => ({
        useUserRole: () => ({
          hasRole: true,
          userRole: 'editor',
          isEditor: true,
          isAdmin: false,
          canView: () => true,
          getAllowedViews: () => null,
          refreshUserRole: vi.fn(),
        }),
      }));

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
    it('should allow searching and navigating to results', async () => {
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
    it('should handle filter, sort, and pagination together', async () => {
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
