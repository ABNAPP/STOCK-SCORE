import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EntryExitTable from '../EntryExitTable';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { EntryExitProvider } from '../../contexts/EntryExitContext';
import {
  createMockEntryExitData,
  generateLargeEntryExitDataSet,
} from '../../test/helpers';
import { EntryExitData } from '../../types/stock';
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

describe('EntryExitTable Integration Tests', () => {
  describe('Rendering', () => {
    it('should render with empty data', () => {
      render(
        <EntryExitTable
          data={[]}
          loading={false}
          error={null}
        />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText(/Inga resultat|No data/i)).toBeInTheDocument();
    });

    it('should render with data', () => {
      const data: EntryExitData[] = [
        createMockEntryExitData({
          companyName: 'Test Company',
          ticker: 'TEST',
          currency: 'USD',
          entry1: 100,
          entry2: 90,
          exit1: 150,
          exit2: 140,
        }),
      ];

      render(
        <EntryExitTable
          data={data}
          loading={false}
          error={null}
        />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText('Test Company')).toBeInTheDocument();
      expect(screen.getByText('TEST')).toBeInTheDocument();
      expect(screen.getByText('USD')).toBeInTheDocument();
    });

    it('should render with large dataset', () => {
      const data = generateLargeEntryExitDataSet(150);

      render(
        <EntryExitTable
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
    it('should filter by currency', async () => {
      const user = userEvent.setup();
      const data: EntryExitData[] = [
        createMockEntryExitData({ ticker: 'TEST1', currency: 'USD' }),
        createMockEntryExitData({ ticker: 'TEST2', currency: 'EUR' }),
      ];

      render(
        <EntryExitTable
          data={data}
          loading={false}
          error={null}
        />,
        { wrapper: TestWrapper }
      );

      // Open filters
      const filterButton = screen.getByText('Filter');
      await user.click(filterButton);

      // Find currency select
      const selects = screen.getAllByRole('combobox');
      const currencySelect = selects.find(select =>
        select.closest('div')?.textContent?.includes('Valuta') ||
        select.closest('div')?.textContent?.includes('Currency')
      ) || selects[0];

      if (currencySelect) {
        await user.selectOptions(currencySelect, 'USD');
      }

      await waitFor(() => {
        expect(screen.getByText('TEST1')).toBeInTheDocument();
        expect(screen.queryByText('TEST2')).not.toBeInTheDocument();
      });
    });

    it('should filter by entry1 range', async () => {
      const user = userEvent.setup();
      const data: EntryExitData[] = [
        createMockEntryExitData({ ticker: 'TEST1', entry1: 50 }),
        createMockEntryExitData({ ticker: 'TEST2', entry1: 100 }),
        createMockEntryExitData({ ticker: 'TEST3', entry1: 200 }),
      ];

      render(
        <EntryExitTable
          data={data}
          loading={false}
          error={null}
        />,
        { wrapper: TestWrapper }
      );

      // Open filters
      const filterButton = screen.getByText('Filter');
      await user.click(filterButton);

      // Find entry1 range inputs
      const inputs = screen.getAllByPlaceholderText(/Min|Max/i);
      const entryInputs = inputs.filter(input => {
        const label = input.closest('div')?.querySelector('label')?.textContent;
        return label?.includes('Entry1');
      });

      if (entryInputs[0] && entryInputs[1]) {
        await user.type(entryInputs[0], '75');
        await user.type(entryInputs[1], '125');
      }

      await waitFor(() => {
        expect(screen.getByText('TEST2')).toBeInTheDocument();
        expect(screen.queryByText('TEST1')).not.toBeInTheDocument();
        expect(screen.queryByText('TEST3')).not.toBeInTheDocument();
      });
    });
  });

  describe('Sorting', () => {
    it('should sort by entry1', async () => {
      const user = userEvent.setup();
      const data: EntryExitData[] = [
        createMockEntryExitData({ ticker: 'TEST1', entry1: 200 }),
        createMockEntryExitData({ ticker: 'TEST2', entry1: 100 }),
        createMockEntryExitData({ ticker: 'TEST3', entry1: 50 }),
      ];

      render(
        <EntryExitTable
          data={data}
          loading={false}
          error={null}
        />,
        { wrapper: TestWrapper }
      );

      // Click entry1 header
      const entryHeader = screen.getByText('ENTRY1');
      await user.click(entryHeader);

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        // Should be sorted ascending (50 first)
        expect(rows[1]).toHaveTextContent('TEST3');
      });
    });
  });

  describe('Loading and error states', () => {
    it('should show loading state', () => {
      render(
        <EntryExitTable
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
        <EntryExitTable
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

