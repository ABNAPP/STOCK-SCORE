import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PEIndustryTable from '../PEIndustryTable';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { EntryExitProvider } from '../../contexts/EntryExitContext';
import {
  createMockPEIndustryData,
  generateLargePEIndustryDataSet,
} from '../../test/helpers';
import { PEIndustryData } from '../../types/stock';
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

describe('PEIndustryTable Integration Tests', () => {
  describe('Rendering', () => {
    it('should render with empty data', () => {
      render(
        <PEIndustryTable
          data={[]}
          loading={false}
          error={null}
        />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText(/Inga resultat|No data/i)).toBeInTheDocument();
    });

    it('should render with data', () => {
      const data: PEIndustryData[] = [
        createMockPEIndustryData({
          industry: 'Technology',
          pe: 15,
          pe1: 20,
          pe2: 18,
          companyCount: 10,
        }),
      ];

      render(
        <PEIndustryTable
          data={data}
          loading={false}
          error={null}
        />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText('Technology')).toBeInTheDocument();
    });

    it('should render with large dataset', () => {
      const data = generateLargePEIndustryDataSet(50);

      render(
        <PEIndustryTable
          data={data}
          loading={false}
          error={null}
        />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText('Technology 1')).toBeInTheDocument();
    });
  });

  describe('Filtering', () => {
    it('should filter by industry', async () => {
      const user = userEvent.setup();
      const data: PEIndustryData[] = [
        createMockPEIndustryData({ industry: 'Technology', pe: 15 }),
        createMockPEIndustryData({ industry: 'Finance', pe: 20 }),
      ];

      render(
        <PEIndustryTable
          data={data}
          loading={false}
          error={null}
        />,
        { wrapper: TestWrapper }
      );

      // Open filters
      const filterButton = screen.getByText('Filter');
      await user.click(filterButton);

      // Find industry select
      const selects = screen.getAllByRole('combobox');
      const industrySelect = selects.find(select =>
        select.closest('div')?.textContent?.includes('Industri') || 
        select.closest('div')?.textContent?.includes('Industry')
      ) || selects[0];

      if (industrySelect) {
        await user.selectOptions(industrySelect, 'Technology');
      }

      await waitFor(() => {
        expect(screen.getByText('Technology')).toBeInTheDocument();
        expect(screen.queryByText('Finance')).not.toBeInTheDocument();
      });
    });
  });

  describe('Sorting', () => {
    it('should sort by P/E values', async () => {
      const user = userEvent.setup();
      const data: PEIndustryData[] = [
        createMockPEIndustryData({ industry: 'Industry 1', pe: 30 }),
        createMockPEIndustryData({ industry: 'Industry 2', pe: 10 }),
        createMockPEIndustryData({ industry: 'Industry 3', pe: 20 }),
      ];

      render(
        <PEIndustryTable
          data={data}
          loading={false}
          error={null}
        />,
        { wrapper: TestWrapper }
      );

      // Click P/E header
      const peHeader = screen.getByText('P/E INDUSTRY');
      await user.click(peHeader);

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        // Should be sorted ascending (10 first)
        expect(rows[1]).toHaveTextContent('Industry 2');
      });
    });
  });

  describe('Loading and error states', () => {
    it('should show loading state', () => {
      render(
        <PEIndustryTable
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
        <PEIndustryTable
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

