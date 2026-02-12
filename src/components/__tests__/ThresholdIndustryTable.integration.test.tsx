import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ThresholdIndustryTable from '../ThresholdIndustryTable';
import { renderWithAuth } from '../../test/helpers/renderHelpers';
import {
  createMockThresholdData,
  generateLargeThresholdDataSet,
} from '../../test/helpers';
import { ThresholdIndustryData } from '../../types/stock';
import '../../i18n/config';

// renderWithAuth provides all providers and defaults to admin role for editable threshold table

describe('ThresholdIndustryTable Integration Tests', () => {
  describe('Rendering', () => {
    it('should render with empty data', () => {
renderWithAuth(
          <ThresholdIndustryTable
            data={[]}
            loading={false}
            error={null}
          />
        );

      expect(screen.getByText(/Inga resultat|No data/i)).toBeInTheDocument();
    });

    it('should render with data', () => {
      const data: ThresholdIndustryData[] = [
        createMockThresholdData({
          industry: 'Technology',
          irr: 25,
          leverageF2Min: 2.0,
          leverageF2Max: 3.0,
          ro40Min: 0.15,
          ro40Max: 0.25,
          cashSdebtMin: 0.7,
          cashSdebtMax: 1.2,
          currentRatioMin: 1.1,
          currentRatioMax: 2.0,
        }),
      ];

      renderWithAuth(
        <ThresholdIndustryTable
          data={data}
          loading={false}
          error={null}
        />,
      );

      expect(screen.getByText('Technology')).toBeInTheDocument();
    });

    it('should render with large dataset', () => {
      const data = generateLargeThresholdDataSet(50);

      renderWithAuth(
        <ThresholdIndustryTable
          data={data}
          loading={false}
          error={null}
        />,
      );

      expect(screen.getByText('Technology 1')).toBeInTheDocument();
    });
  });

  describe('Filtering', () => {
    it('should filter by industry', async () => {
      const user = userEvent.setup();
      const data: ThresholdIndustryData[] = [
        createMockThresholdData({ industry: 'Technology', irr: 25 }),
        createMockThresholdData({ industry: 'Finance', irr: 20 }),
      ];

      renderWithAuth(
        <ThresholdIndustryTable
          data={data}
          loading={false}
          error={null}
        />,
      );

      // Open filters
      const filterButton = screen.getByText('Filter');
      await user.click(filterButton);

      // Find industry select
      const selects = screen.getAllByRole('combobox');
      const industrySelect = selects.find(select =>
        select.closest('div')?.textContent?.includes('INDUSTRY') ||
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

    it('should filter by IRR range', async () => {
      const user = userEvent.setup();
      const data: ThresholdIndustryData[] = [
        createMockThresholdData({ industry: 'Industry 1', irr: 15 }),
        createMockThresholdData({ industry: 'Industry 2', irr: 25 }),
        createMockThresholdData({ industry: 'Industry 3', irr: 35 }),
      ];

      renderWithAuth(
        <ThresholdIndustryTable
          data={data}
          loading={false}
          error={null}
        />,
      );

      // Open filters
      const filterButton = screen.getByText('Filter');
      await user.click(filterButton);

      // Find IRR range inputs
      const inputs = screen.getAllByPlaceholderText(/Min|Max/i);
      const irrInputs = inputs.filter(input => {
        const label = input.closest('div')?.querySelector('label')?.textContent;
        return label?.includes('IRR');
      });

      if (irrInputs[0] && irrInputs[1]) {
        await user.type(irrInputs[0], '20');
        await user.type(irrInputs[1], '30');
      }

      await waitFor(() => {
        expect(screen.getByText('Industry 2')).toBeInTheDocument();
        expect(screen.queryByText('Industry 1')).not.toBeInTheDocument();
        expect(screen.queryByText('Industry 3')).not.toBeInTheDocument();
      });
    });
  });

  describe('Sorting', () => {
    it('should sort by IRR', async () => {
      const user = userEvent.setup();
      const data: ThresholdIndustryData[] = [
        createMockThresholdData({ industry: 'Industry 1', irr: 35 }),
        createMockThresholdData({ industry: 'Industry 2', irr: 15 }),
        createMockThresholdData({ industry: 'Industry 3', irr: 25 }),
      ];

      renderWithAuth(
        <ThresholdIndustryTable
          data={data}
          loading={false}
          error={null}
        />,
      );

      // Click IRR header
      const irrHeader = screen.getByText('IRR');
      await user.click(irrHeader);

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        // Should be sorted ascending (15 first)
        expect(rows[1]).toHaveTextContent('Industry 2');
      });
    });

    it('should sort by leverageF2Min', async () => {
      const user = userEvent.setup();
      const data: ThresholdIndustryData[] = [
        createMockThresholdData({ industry: 'Industry 1', leverageF2Min: 3.0 }),
        createMockThresholdData({ industry: 'Industry 2', leverageF2Min: 1.0 }),
        createMockThresholdData({ industry: 'Industry 3', leverageF2Min: 2.0 }),
      ];

      renderWithAuth(
        <ThresholdIndustryTable
          data={data}
          loading={false}
          error={null}
        />,
      );

      // Click leverageF2Min header
      const leverageHeader = screen.getByText('LEVERAGE F2 MIN');
      await user.click(leverageHeader);

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        // Should be sorted ascending (1.0 first)
        expect(rows[1]).toHaveTextContent('Industry 2');
      });
    });
  });

  describe('Loading and error states', () => {
    it('should show loading state', () => {
      renderWithAuth(
        <ThresholdIndustryTable
          data={[]}
          loading={true}
          error={null}
        />,
      );

      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
    });

    it('should show error state', () => {
      renderWithAuth(
        <ThresholdIndustryTable
          data={[]}
          loading={false}
          error="Failed to load data"
        />,
      );

      expect(screen.getByText(/error|Error/i)).toBeInTheDocument();
      expect(screen.getByText('Failed to load data')).toBeInTheDocument();
    });
  });
});

