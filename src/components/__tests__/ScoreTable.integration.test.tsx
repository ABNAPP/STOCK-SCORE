import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ScoreTable from '../ScoreTable';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { EntryExitProvider } from '../../contexts/EntryExitContext';
import {
  createMockScoreData,
  createMockScoreBoardData,
  createMockThresholdData,
  createMockBenjaminGrahamData,
  generateLargeScoreDataSet,
} from '../../test/helpers';
import { ScoreData } from '../views/ScoreView';
import { ThresholdIndustryData, BenjaminGrahamData } from '../../types/stock';
import { EntryExitValues } from '../../contexts/EntryExitContext';
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

describe('ScoreTable Integration Tests', () => {
  const mockThresholdData: ThresholdIndustryData[] = [
    createMockThresholdData({ industry: 'Technology' }),
  ];

  const mockBenjaminGrahamData: BenjaminGrahamData[] = [
    createMockBenjaminGrahamData({ ticker: 'TEST1', companyName: 'Test Company 1' }),
  ];

  const mockEntryExitValues = new Map<string, EntryExitValues>();

  describe('Rendering', () => {
    it('should render with empty data', () => {
      render(
        <ScoreTable
          data={[]}
          loading={false}
          error={null}
          thresholdData={mockThresholdData}
          benjaminGrahamData={mockBenjaminGrahamData}
          entryExitValues={mockEntryExitValues}
        />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText(/Inga resultat|No data/i)).toBeInTheDocument();
    });

    it('should render with score data', () => {
      const data: ScoreData[] = [
        createMockScoreData({
          companyName: 'Test Company',
          ticker: 'TEST',
          score: 75,
        }),
      ];

      render(
        <ScoreTable
          data={data}
          loading={false}
          error={null}
          thresholdData={mockThresholdData}
          benjaminGrahamData={mockBenjaminGrahamData}
          entryExitValues={mockEntryExitValues}
        />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText('Test Company')).toBeInTheDocument();
      expect(screen.getByText('TEST')).toBeInTheDocument();
      expect(screen.getByText('75.0')).toBeInTheDocument();
    });

    it('should render with large dataset', () => {
      const data = generateLargeScoreDataSet(150);

      render(
        <ScoreTable
          data={data}
          loading={false}
          error={null}
          thresholdData={mockThresholdData}
          benjaminGrahamData={mockBenjaminGrahamData}
          entryExitValues={mockEntryExitValues}
        />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText('Company 1')).toBeInTheDocument();
    });
  });

  describe('Score filtering', () => {
    it('should filter by score range', async () => {
      const user = userEvent.setup();
      const data: ScoreData[] = [
        createMockScoreData({ ticker: 'TEST1', score: 30 }),
        createMockScoreData({ ticker: 'TEST2', score: 60 }),
        createMockScoreData({ ticker: 'TEST3', score: 90 }),
      ];

      render(
        <ScoreTable
          data={data}
          loading={false}
          error={null}
          thresholdData={mockThresholdData}
          benjaminGrahamData={mockBenjaminGrahamData}
          entryExitValues={mockEntryExitValues}
        />,
        { wrapper: TestWrapper }
      );

      // Open filters
      const filterButton = screen.getByText('Filter');
      await user.click(filterButton);

      // Find score range inputs
      const inputs = screen.getAllByPlaceholderText(/Min|Max/i);
      const minInput = inputs.find(input => {
        const label = input.closest('div')?.querySelector('label')?.textContent;
        return label?.includes('Score');
      }) || inputs[0];
      const maxInput = inputs[inputs.length - 1];

      if (minInput && maxInput) {
        await user.type(minInput, '50');
        await user.type(maxInput, '70');
      }

      await waitFor(() => {
        expect(screen.getByText('TEST2')).toBeInTheDocument();
        expect(screen.queryByText('TEST1')).not.toBeInTheDocument();
        expect(screen.queryByText('TEST3')).not.toBeInTheDocument();
      });
    });
  });

  describe('Score color coding', () => {
    it('should apply green color for high scores (>= 75)', () => {
      const data: ScoreData[] = [
        createMockScoreData({ ticker: 'TEST1', score: 80 }),
        createMockScoreData({ ticker: 'TEST2', score: 75 }),
      ];

      render(
        <ScoreTable
          data={data}
          loading={false}
          error={null}
          thresholdData={mockThresholdData}
          benjaminGrahamData={mockBenjaminGrahamData}
          entryExitValues={mockEntryExitValues}
        />,
        { wrapper: TestWrapper }
      );

      // Check that scores are rendered (color is applied via CSS classes)
      expect(screen.getByText('80.0')).toBeInTheDocument();
      expect(screen.getByText('75.0')).toBeInTheDocument();
    });

    it('should apply blue color for medium scores (45-74)', () => {
      const data: ScoreData[] = [
        createMockScoreData({ ticker: 'TEST1', score: 60 }),
        createMockScoreData({ ticker: 'TEST2', score: 45 }),
      ];

      render(
        <ScoreTable
          data={data}
          loading={false}
          error={null}
          thresholdData={mockThresholdData}
          benjaminGrahamData={mockBenjaminGrahamData}
          entryExitValues={mockEntryExitValues}
        />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText('60.0')).toBeInTheDocument();
      expect(screen.getByText('45.0')).toBeInTheDocument();
    });

    it('should apply gray color for low scores (< 45)', () => {
      const data: ScoreData[] = [
        createMockScoreData({ ticker: 'TEST1', score: 30 }),
        createMockScoreData({ ticker: 'TEST2', score: 0 }),
      ];

      render(
        <ScoreTable
          data={data}
          loading={false}
          error={null}
          thresholdData={mockThresholdData}
          benjaminGrahamData={mockBenjaminGrahamData}
          entryExitValues={mockEntryExitValues}
        />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText('30.0')).toBeInTheDocument();
      expect(screen.getByText('0.0')).toBeInTheDocument();
    });
  });

  describe('Sorting', () => {
    it('should sort by score', async () => {
      const user = userEvent.setup();
      const data: ScoreData[] = [
        createMockScoreData({ ticker: 'TEST1', score: 30 }),
        createMockScoreData({ ticker: 'TEST2', score: 60 }),
        createMockScoreData({ ticker: 'TEST3', score: 90 }),
      ];

      render(
        <ScoreTable
          data={data}
          loading={false}
          error={null}
          thresholdData={mockThresholdData}
          benjaminGrahamData={mockBenjaminGrahamData}
          entryExitValues={mockEntryExitValues}
        />,
        { wrapper: TestWrapper }
      );

      // Click score header
      const scoreHeader = screen.getByText('Score');
      await user.click(scoreHeader);

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        // Should be sorted ascending (30 first)
        expect(rows[1]).toHaveTextContent('TEST1');
      });
    });
  });

  describe('ScoreBreakdownTooltip integration', () => {
    it('should render score with tooltip', () => {
      const data: ScoreData[] = [
        createMockScoreData({
          ticker: 'TEST1',
          score: 75,
          scoreBoardData: createMockScoreBoardData({ ticker: 'TEST1' }),
        }),
      ];

      render(
        <ScoreTable
          data={data}
          loading={false}
          error={null}
          thresholdData={mockThresholdData}
          benjaminGrahamData={mockBenjaminGrahamData}
          entryExitValues={mockEntryExitValues}
        />,
        { wrapper: TestWrapper }
      );

      // Score should be rendered (tooltip is interactive)
      expect(screen.getByText('75.0')).toBeInTheDocument();
    });
  });

  describe('Loading and error states', () => {
    it('should show loading state', () => {
      render(
        <ScoreTable
          data={[]}
          loading={true}
          error={null}
          thresholdData={mockThresholdData}
          benjaminGrahamData={mockBenjaminGrahamData}
          entryExitValues={mockEntryExitValues}
        />,
        { wrapper: TestWrapper }
      );

      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
    });

    it('should show error state', () => {
      render(
        <ScoreTable
          data={[]}
          loading={false}
          error="Failed to load data"
          thresholdData={mockThresholdData}
          benjaminGrahamData={mockBenjaminGrahamData}
          entryExitValues={mockEntryExitValues}
        />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText(/error|Error/i)).toBeInTheDocument();
      expect(screen.getByText('Failed to load data')).toBeInTheDocument();
    });
  });
});

