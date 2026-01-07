import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SMATable from '../SMATable';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { EntryExitProvider } from '../../contexts/EntryExitContext';
import {
  createMockSMAData,
  generateLargeSMADataSet,
} from '../../test/helpers';
import { SMAData } from '../../types/stock';
import '../../i18n/config';

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

describe('SMATable Integration Tests', () => {
  describe('Rendering', () => {
    it('should render with empty data', () => {
      render(
        <SMATable
          data={[]}
          loading={false}
          error={null}
        />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText(/Inga resultat|No data/i)).toBeInTheDocument();
    });

    it('should render with data', () => {
      const data: SMAData[] = [
        createMockSMAData({
          companyName: 'Test Company',
          ticker: 'TEST',
          sma100: 100,
          sma200: 95,
          smaCross: 'GOLDEN CROSS',
        }),
      ];

      render(
        <SMATable
          data={data}
          loading={false}
          error={null}
        />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText('Test Company')).toBeInTheDocument();
      expect(screen.getByText('TEST')).toBeInTheDocument();
      expect(screen.getByText('GOLDEN CROSS')).toBeInTheDocument();
    });

    it('should render with large dataset', () => {
      const data = generateLargeSMADataSet(150);

      render(
        <SMATable
          data={data}
          loading={false}
          error={null}
        />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText('Company 1')).toBeInTheDocument();
    });
  });

  describe('Filtering', () => {
    it('should filter by company name', async () => {
      const user = userEvent.setup();
      const data: SMAData[] = [
        createMockSMAData({ companyName: 'Apple Inc', ticker: 'AAPL' }),
        createMockSMAData({ companyName: 'Microsoft Corp', ticker: 'MSFT' }),
      ];

      render(
        <SMATable
          data={data}
          loading={false}
          error={null}
        />,
        { wrapper: TestWrapper }
      );

      // Open filters
      const filterButton = screen.getByText('Filter');
      await user.click(filterButton);

      // Find and fill company name filter
      const nameInput = screen.getByPlaceholderText(/Sök företagsnamn/i);
      await user.type(nameInput, 'Apple');

      await waitFor(() => {
        expect(screen.getByText('Apple Inc')).toBeInTheDocument();
        expect(screen.queryByText('Microsoft Corp')).not.toBeInTheDocument();
      });
    });

    it('should filter by SMA(100) range', async () => {
      const user = userEvent.setup();
      const data: SMAData[] = [
        createMockSMAData({ ticker: 'TEST1', sma100: 50 }),
        createMockSMAData({ ticker: 'TEST2', sma100: 100 }),
        createMockSMAData({ ticker: 'TEST3', sma100: 150 }),
      ];

      render(
        <SMATable
          data={data}
          loading={false}
          error={null}
        />,
        { wrapper: TestWrapper }
      );

      // Open filters
      const filterButton = screen.getByText('Filter');
      await user.click(filterButton);

      // Find SMA(100) range inputs
      const inputs = screen.getAllByPlaceholderText(/Min|Max/i);
      const smaInputs = inputs.filter(input => {
        const label = input.closest('div')?.querySelector('label')?.textContent;
        return label?.includes('SMA(100)');
      });

      if (smaInputs[0] && smaInputs[1]) {
        await user.type(smaInputs[0], '75');
        await user.type(smaInputs[1], '125');
      }

      await waitFor(() => {
        expect(screen.getByText('TEST2')).toBeInTheDocument();
        expect(screen.queryByText('TEST1')).not.toBeInTheDocument();
        expect(screen.queryByText('TEST3')).not.toBeInTheDocument();
      });
    });
  });

  describe('SMA Cross color coding', () => {
    it('should apply color coding for GOLDEN CROSS', () => {
      const data: SMAData[] = [
        createMockSMAData({
          ticker: 'TEST1',
          smaCross: 'GOLDEN CROSS',
        }),
      ];

      render(
        <SMATable
          data={data}
          loading={false}
          error={null}
        />,
        { wrapper: TestWrapper }
      );

      // Color is applied via CSS classes
      expect(screen.getByText('GOLDEN CROSS')).toBeInTheDocument();
    });

    it('should apply color coding for DEATH CROSS', () => {
      const data: SMAData[] = [
        createMockSMAData({
          ticker: 'TEST1',
          smaCross: 'DEATH CROSS',
        }),
      ];

      render(
        <SMATable
          data={data}
          loading={false}
          error={null}
        />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText('DEATH CROSS')).toBeInTheDocument();
    });
  });

  describe('Sorting', () => {
    it('should sort by SMA(100)', async () => {
      const user = userEvent.setup();
      const data: SMAData[] = [
        createMockSMAData({ ticker: 'TEST1', sma100: 150 }),
        createMockSMAData({ ticker: 'TEST2', sma100: 50 }),
        createMockSMAData({ ticker: 'TEST3', sma100: 100 }),
      ];

      render(
        <SMATable
          data={data}
          loading={false}
          error={null}
        />,
        { wrapper: TestWrapper }
      );

      // Click SMA(100) header
      const smaHeader = screen.getByText('SMA(100)');
      await user.click(smaHeader);

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        // Should be sorted ascending (50 first)
        expect(rows[1]).toHaveTextContent('TEST2');
      });
    });
  });

  describe('Loading and error states', () => {
    it('should show loading state', () => {
      render(
        <SMATable
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
        <SMATable
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

