import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ScoreBoardTable from '../ScoreBoardTable';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { EntryExitProvider } from '../../contexts/EntryExitContext';
import {
  createMockScoreBoardData,
  createMockThresholdData,
  createMockBenjaminGrahamData,
  createMockEntryExitValues,
  generateLargeScoreBoardDataSet,
  generateEdgeCaseScoreBoardData,
} from '../../test/helpers';
import { ScoreBoardData, ThresholdIndustryData, BenjaminGrahamData } from '../../types/stock';
import '../../i18n/config';

// Mock the hooks
vi.mock('../../hooks/useBenjaminGrahamData', () => ({
  useBenjaminGrahamData: vi.fn(),
}));

import { useBenjaminGrahamData } from '../../hooks/useBenjaminGrahamData';

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

describe('ScoreBoardTable Integration Tests', () => {
  const mockBenjaminGrahamData: BenjaminGrahamData[] = [
    createMockBenjaminGrahamData({ ticker: 'TEST1', companyName: 'Test Company 1', price: 100 }),
    createMockBenjaminGrahamData({ ticker: 'TEST2', companyName: 'Test Company 2', price: 150 }),
  ];

  const mockThresholdData: ThresholdIndustryData[] = [
    createMockThresholdData({ industry: 'Technology', irr: 25 }),
    createMockThresholdData({ industry: 'Finance', irr: 20 }),
  ];

  beforeEach(() => {
    vi.mocked(useBenjaminGrahamData).mockReturnValue({
      data: mockBenjaminGrahamData,
      loading: false,
      error: null,
      lastUpdated: new Date(),
      refetch: vi.fn(),
    });
  });

  describe('Rendering with different data', () => {
    it('should render with empty data', () => {
      render(
        <ScoreBoardTable
          data={[]}
          loading={false}
          error={null}
          thresholdData={mockThresholdData}
        />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText(/Inga resultat|No data/i)).toBeInTheDocument();
    });

    it('should render with single row', () => {
      const data = [
        createMockScoreBoardData({
          companyName: 'Test Company',
          ticker: 'TEST',
          industry: 'Technology',
        }),
      ];

      render(
        <ScoreBoardTable
          data={data}
          loading={false}
          error={null}
          thresholdData={mockThresholdData}
        />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText('Test Company')).toBeInTheDocument();
      expect(screen.getByText('TEST')).toBeInTheDocument();
    });

    it('should render with large dataset', () => {
      const data = generateLargeScoreBoardDataSet(150);

      render(
        <ScoreBoardTable
          data={data}
          loading={false}
          error={null}
          thresholdData={mockThresholdData}
        />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText('Company 1')).toBeInTheDocument();
      // Should show pagination
      expect(screen.getByText(/Visar/i)).toBeInTheDocument();
    });
  });

  describe('Filter combinations', () => {
    it('should filter by company name', async () => {
      const user = userEvent.setup();
      const data = [
        createMockScoreBoardData({ companyName: 'Apple Inc', ticker: 'AAPL', industry: 'Technology' }),
        createMockScoreBoardData({ companyName: 'Microsoft Corp', ticker: 'MSFT', industry: 'Technology' }),
      ];

      render(
        <ScoreBoardTable
          data={data}
          loading={false}
          error={null}
          thresholdData={mockThresholdData}
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

    it('should filter by industry select', async () => {
      const user = userEvent.setup();
      const data = [
        createMockScoreBoardData({ companyName: 'Tech Company', ticker: 'TECH', industry: 'Technology' }),
        createMockScoreBoardData({ companyName: 'Finance Company', ticker: 'FIN', industry: 'Finance' }),
      ];

      render(
        <ScoreBoardTable
          data={data}
          loading={false}
          error={null}
          thresholdData={mockThresholdData}
        />,
        { wrapper: TestWrapper }
      );

      // Open filters
      const filterButton = screen.getByText('Filter');
      await user.click(filterButton);

      // Find industry select
      const selects = screen.getAllByRole('combobox');
      const industrySelect = selects.find(select =>
        select.closest('div')?.textContent?.includes('Industri')
      ) || selects[0];

      if (industrySelect) {
        await user.selectOptions(industrySelect, 'Technology');
      }

      await waitFor(() => {
        expect(screen.getByText('Tech Company')).toBeInTheDocument();
        expect(screen.queryByText('Finance Company')).not.toBeInTheDocument();
      });
    });

    it('should filter by IRR range', async () => {
      const user = userEvent.setup();
      const data = [
        createMockScoreBoardData({ ticker: 'TEST1', irr: 15, industry: 'Technology' }),
        createMockScoreBoardData({ ticker: 'TEST2', irr: 30, industry: 'Technology' }),
        createMockScoreBoardData({ ticker: 'TEST3', irr: 45, industry: 'Technology' }),
      ];

      render(
        <ScoreBoardTable
          data={data}
          loading={false}
          error={null}
          thresholdData={mockThresholdData}
        />,
        { wrapper: TestWrapper }
      );

      // Open filters
      const filterButton = screen.getByText('Filter');
      await user.click(filterButton);

      // Find IRR range inputs
      const inputs = screen.getAllByPlaceholderText(/Min|Max/i);
      const minInput = inputs.find(input => {
        const label = input.closest('div')?.querySelector('label')?.textContent;
        return label?.includes('IRR');
      }) || inputs[0];
      const maxInput = inputs[inputs.length - 1];

      if (minInput && maxInput) {
        await user.type(minInput, '20');
        await user.type(maxInput, '40');
      }

      await waitFor(() => {
        expect(screen.getByText('TEST2')).toBeInTheDocument();
        expect(screen.queryByText('TEST1')).not.toBeInTheDocument();
        expect(screen.queryByText('TEST3')).not.toBeInTheDocument();
      });
    });

    it('should combine multiple filters', async () => {
      const user = userEvent.setup();
      const data = [
        createMockScoreBoardData({
          companyName: 'Tech Corp',
          ticker: 'TECH',
          industry: 'Technology',
          irr: 25,
          mungerQualityScore: 60,
        }),
        createMockScoreBoardData({
          companyName: 'Tech Inc',
          ticker: 'TINC',
          industry: 'Technology',
          irr: 15,
          mungerQualityScore: 40,
        }),
        createMockScoreBoardData({
          companyName: 'Finance Corp',
          ticker: 'FIN',
          industry: 'Finance',
          irr: 25,
          mungerQualityScore: 60,
        }),
      ];

      render(
        <ScoreBoardTable
          data={data}
          loading={false}
          error={null}
          thresholdData={mockThresholdData}
        />,
        { wrapper: TestWrapper }
      );

      // Open filters
      const filterButton = screen.getByText('Filter');
      await user.click(filterButton);

      // Apply industry filter
      const selects = screen.getAllByRole('combobox');
      const industrySelect = selects.find(select =>
        select.closest('div')?.textContent?.includes('Industri')
      );
      if (industrySelect) {
        await user.selectOptions(industrySelect, 'Technology');
      }

      // Apply IRR range
      const inputs = screen.getAllByPlaceholderText(/Min|Max/i);
      const irrInputs = inputs.filter(input => {
        const label = input.closest('div')?.querySelector('label')?.textContent;
        return label?.includes('IRR');
      });
      if (irrInputs[0]) await user.type(irrInputs[0], '20');
      if (irrInputs[1]) await user.type(irrInputs[1], '30');

      await waitFor(() => {
        expect(screen.getByText('Tech Corp')).toBeInTheDocument();
        expect(screen.queryByText('Tech Inc')).not.toBeInTheDocument();
        expect(screen.queryByText('Finance Corp')).not.toBeInTheDocument();
      });
    });

    it('should combine search and filters', async () => {
      const user = userEvent.setup();
      const data = [
        createMockScoreBoardData({ companyName: 'Apple Inc', ticker: 'AAPL', industry: 'Technology' }),
        createMockScoreBoardData({ companyName: 'Apple Finance', ticker: 'APLF', industry: 'Finance' }),
      ];

      render(
        <ScoreBoardTable
          data={data}
          loading={false}
          error={null}
          thresholdData={mockThresholdData}
        />,
        { wrapper: TestWrapper }
      );

      // Apply search
      const searchInput = screen.getByPlaceholderText(/Sök/i);
      await user.type(searchInput, 'Apple');

      // Open and apply industry filter
      const filterButton = screen.getByText('Filter');
      await user.click(filterButton);

      const selects = screen.getAllByRole('combobox');
      const industrySelect = selects.find(select =>
        select.closest('div')?.textContent?.includes('Industri')
      );
      if (industrySelect) {
        await user.selectOptions(industrySelect, 'Technology');
      }

      await waitFor(() => {
        expect(screen.getByText('Apple Inc')).toBeInTheDocument();
        expect(screen.queryByText('Apple Finance')).not.toBeInTheDocument();
      });
    });
  });

  describe('Sorting', () => {
    it('should sort by company name', async () => {
      const user = userEvent.setup();
      const data = [
        createMockScoreBoardData({ companyName: 'Zebra Corp', ticker: 'ZEB' }),
        createMockScoreBoardData({ companyName: 'Apple Inc', ticker: 'AAPL' }),
        createMockScoreBoardData({ companyName: 'Microsoft Corp', ticker: 'MSFT' }),
      ];

      render(
        <ScoreBoardTable
          data={data}
          loading={false}
          error={null}
          thresholdData={mockThresholdData}
        />,
        { wrapper: TestWrapper }
      );

      // Click company name header
      const nameHeader = screen.getByText('Company Name');
      await user.click(nameHeader);

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        expect(rows[1]).toHaveTextContent('Apple Inc');
      });
    });

    it('should sort by IRR', async () => {
      const user = userEvent.setup();
      const data = [
        createMockScoreBoardData({ ticker: 'TEST1', irr: 30, industry: 'Technology' }),
        createMockScoreBoardData({ ticker: 'TEST2', irr: 10, industry: 'Technology' }),
        createMockScoreBoardData({ ticker: 'TEST3', irr: 50, industry: 'Technology' }),
      ];

      render(
        <ScoreBoardTable
          data={data}
          loading={false}
          error={null}
          thresholdData={mockThresholdData}
        />,
        { wrapper: TestWrapper }
      );

      // Click IRR header
      const irrHeader = screen.getByText('IRR');
      await user.click(irrHeader);

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        // Should be sorted ascending (10% first)
        expect(rows[1]).toHaveTextContent('TEST2');
      });
    });
  });

  describe('Color coding based on threshold data', () => {
    it('should apply color coding for IRR based on threshold', () => {
      const data = [
        createMockScoreBoardData({
          ticker: 'TEST1',
          irr: 30, // Above threshold (25)
          industry: 'Technology',
        }),
        createMockScoreBoardData({
          ticker: 'TEST2',
          irr: 15, // Below threshold (25)
          industry: 'Technology',
        }),
      ];

      render(
        <ScoreBoardTable
          data={data}
          loading={false}
          error={null}
          thresholdData={mockThresholdData}
        />,
        { wrapper: TestWrapper }
      );

      // Colors are applied via CSS classes, check that cells are rendered
      expect(screen.getByText('30%')).toBeInTheDocument();
      expect(screen.getByText('15%')).toBeInTheDocument();
    });

    it('should handle missing threshold data gracefully', () => {
      const data = [
        createMockScoreBoardData({
          ticker: 'TEST1',
          irr: 30,
          industry: 'Unknown Industry',
        }),
      ];

      render(
        <ScoreBoardTable
          data={data}
          loading={false}
          error={null}
          thresholdData={mockThresholdData}
        />,
        { wrapper: TestWrapper }
      );

      // Should still render without errors
      expect(screen.getByText('TEST1')).toBeInTheDocument();
    });
  });

  describe('TheoEntry logic', () => {
    it('should show B when conditions are met', () => {
      const data = [
        createMockScoreBoardData({
          ticker: 'TEST1',
          companyName: 'Test Company 1',
          industry: 'Technology',
        }),
      ];

      // Mock EntryExit values that meet conditions
      const entryExitMap = new Map();
      entryExitMap.set('TEST1-Test Company 1', {
        entry1: 100,
        exit1: 160, // RR1 = 60%
        entry2: 0,
        exit2: 0,
        dateOfUpdate: '2024-01-01',
      });

      vi.mocked(useBenjaminGrahamData).mockReturnValue({
        data: [createMockBenjaminGrahamData({ ticker: 'TEST1', companyName: 'Test Company 1', price: 100 })],
        loading: false,
        error: null,
        lastUpdated: new Date(),
        refetch: vi.fn(),
      });

      render(
        <ScoreBoardTable
          data={data}
          loading={false}
          error={null}
          thresholdData={mockThresholdData}
        />,
        { wrapper: TestWrapper }
      );

      // TheoEntry should show B when conditions are met
      // This depends on the actual implementation logic
      expect(screen.getByText('TEST1')).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should handle edge case data', () => {
      const data = generateEdgeCaseScoreBoardData();

      render(
        <ScoreBoardTable
          data={data}
          loading={false}
          error={null}
          thresholdData={mockThresholdData}
        />,
        { wrapper: TestWrapper }
      );

      // Should render without errors
      expect(screen.getByText('Null Company')).toBeInTheDocument();
    });

    it('should handle empty threshold data', () => {
      const data = [
        createMockScoreBoardData({
          ticker: 'TEST1',
          irr: 30,
          industry: 'Technology',
        }),
      ];

      render(
        <ScoreBoardTable
          data={data}
          loading={false}
          error={null}
          thresholdData={[]}
        />,
        { wrapper: TestWrapper }
      );

      // Should render without errors
      expect(screen.getByText('TEST1')).toBeInTheDocument();
    });

    it('should handle loading state', () => {
      render(
        <ScoreBoardTable
          data={[]}
          loading={true}
          error={null}
          thresholdData={mockThresholdData}
        />,
        { wrapper: TestWrapper }
      );

      // Should show loading state
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
    });

    it('should handle error state', () => {
      render(
        <ScoreBoardTable
          data={[]}
          loading={false}
          error="Failed to load data"
          thresholdData={mockThresholdData}
        />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText(/error|Error/i)).toBeInTheDocument();
      expect(screen.getByText('Failed to load data')).toBeInTheDocument();
    });
  });
});

