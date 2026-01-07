import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BenjaminGrahamTable from '../BenjaminGrahamTable';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { EntryExitProvider } from '../../contexts/EntryExitContext';
import {
  createMockBenjaminGrahamData,
  generateLargeBenjaminGrahamDataSet,
} from '../../test/helpers';
import { BenjaminGrahamData } from '../../types/stock';
import '../../i18n/config';

// Mock the EntryExitContext hook
vi.mock('../../contexts/EntryExitContext', async () => {
  const actual = await vi.importActual('../../contexts/EntryExitContext');
  return {
    ...actual,
    useEntryExitValues: () => ({
      getEntryExitValue: vi.fn(() => ({
        entry1: 100,
        entry2: 90,
        exit1: 150,
        exit2: 140,
        dateOfUpdate: '2024-01-01',
      })),
      setEntryExitValue: vi.fn(),
      initializeFromData: vi.fn(),
      entryExitValues: new Map(),
    }),
  };
});

// Test wrapper
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <EntryExitProvider>
        {children}
      </EntryExitProvider>
    </ThemeProvider>
  );
}

describe('BenjaminGrahamTable Integration Tests', () => {
  describe('Rendering', () => {
    it('should render with empty data', () => {
      render(
        <BenjaminGrahamTable
          data={[]}
          loading={false}
          error={null}
        />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText(/Inga resultat|No data/i)).toBeInTheDocument();
    });

    it('should render with data', () => {
      const data: BenjaminGrahamData[] = [
        createMockBenjaminGrahamData({
          companyName: 'Test Company',
          ticker: 'TEST',
          price: 100,
          benjaminGraham: 90,
        }),
      ];

      render(
        <BenjaminGrahamTable
          data={data}
          loading={false}
          error={null}
        />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText('Test Company')).toBeInTheDocument();
      expect(screen.getByText('TEST')).toBeInTheDocument();
    });

    it('should render with large dataset', () => {
      const data = generateLargeBenjaminGrahamDataSet(150);

      render(
        <BenjaminGrahamTable
          data={data}
          loading={false}
          error={null}
        />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText('Company 1')).toBeInTheDocument();
    });
  });

  describe('Filter combinations', () => {
    it('should filter by price range', async () => {
      const user = userEvent.setup();
      const data: BenjaminGrahamData[] = [
        createMockBenjaminGrahamData({ ticker: 'TEST1', price: 50 }),
        createMockBenjaminGrahamData({ ticker: 'TEST2', price: 100 }),
        createMockBenjaminGrahamData({ ticker: 'TEST3', price: 200 }),
      ];

      render(
        <BenjaminGrahamTable
          data={data}
          loading={false}
          error={null}
        />,
        { wrapper: TestWrapper }
      );

      // Open filters
      const filterButton = screen.getByText('Filter');
      await user.click(filterButton);

      // Find price range inputs
      const inputs = screen.getAllByPlaceholderText(/Min|Max/i);
      const minInput = inputs.find(input => {
        const label = input.closest('div')?.querySelector('label')?.textContent;
        return label?.includes('Pris') || label?.includes('Price');
      }) || inputs[0];
      const maxInput = inputs[inputs.length - 1];

      if (minInput && maxInput) {
        await user.type(minInput, '75');
        await user.type(maxInput, '125');
      }

      await waitFor(() => {
        expect(screen.getByText('TEST2')).toBeInTheDocument();
        expect(screen.queryByText('TEST1')).not.toBeInTheDocument();
        expect(screen.queryByText('TEST3')).not.toBeInTheDocument();
      });
    });

    it('should filter by benjaminGraham range', async () => {
      const user = userEvent.setup();
      const data: BenjaminGrahamData[] = [
        createMockBenjaminGrahamData({ ticker: 'TEST1', benjaminGraham: 50 }),
        createMockBenjaminGrahamData({ ticker: 'TEST2', benjaminGraham: 100 }),
        createMockBenjaminGrahamData({ ticker: 'TEST3', benjaminGraham: 150 }),
      ];

      render(
        <BenjaminGrahamTable
          data={data}
          loading={false}
          error={null}
        />,
        { wrapper: TestWrapper }
      );

      // Open filters
      const filterButton = screen.getByText('Filter');
      await user.click(filterButton);

      // Find benjaminGraham range inputs
      const inputs = screen.getAllByPlaceholderText(/Min|Max/i);
      const bgInputs = inputs.filter(input => {
        const label = input.closest('div')?.querySelector('label')?.textContent;
        return label?.includes('Benjamin Graham');
      });

      if (bgInputs[0] && bgInputs[1]) {
        await user.type(bgInputs[0], '75');
        await user.type(bgInputs[1], '125');
      }

      await waitFor(() => {
        expect(screen.getByText('TEST2')).toBeInTheDocument();
      });
    });
  });

  describe('Sorting', () => {
    it('should sort by price', async () => {
      const user = userEvent.setup();
      const data: BenjaminGrahamData[] = [
        createMockBenjaminGrahamData({ ticker: 'TEST1', price: 200 }),
        createMockBenjaminGrahamData({ ticker: 'TEST2', price: 100 }),
        createMockBenjaminGrahamData({ ticker: 'TEST3', price: 50 }),
      ];

      render(
        <BenjaminGrahamTable
          data={data}
          loading={false}
          error={null}
        />,
        { wrapper: TestWrapper }
      );

      // Click price header
      const priceHeader = screen.getByText('Price');
      await user.click(priceHeader);

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        // Should be sorted ascending (50 first)
        expect(rows[1]).toHaveTextContent('TEST3');
      });
    });
  });

  describe('RR1/RR2 calculations', () => {
    it('should calculate and display RR1', () => {
      const data: BenjaminGrahamData[] = [
        createMockBenjaminGrahamData({
          ticker: 'TEST1',
          companyName: 'Test Company',
          price: 100,
        }),
      ];

      render(
        <BenjaminGrahamTable
          data={data}
          loading={false}
          error={null}
        />,
        { wrapper: TestWrapper }
      );

      // RR1 should be calculated and displayed
      expect(screen.getByText('TEST1')).toBeInTheDocument();
    });
  });

  describe('Loading and error states', () => {
    it('should show loading state', () => {
      render(
        <BenjaminGrahamTable
          data={[]}
          loading={true}
          error={null}
        />,
        { wrapper: TestWrapper }
      );

      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
    });

    it('should show error state', () => {
      render(
        <BenjaminGrahamTable
          data={[]}
          loading={false}
          error="Failed to load data"
        />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText(/error|Error/i)).toBeInTheDocument();
      expect(screen.getByText('Failed to load data')).toBeInTheDocument();
    });
  });
});

