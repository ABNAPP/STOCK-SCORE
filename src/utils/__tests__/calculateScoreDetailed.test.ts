import { describe, it, expect } from 'vitest';
import { calculateDetailedScoreBreakdown, calculateDetailedScore } from '../calculateScoreDetailed';
import {
  createMockScoreBoardData,
  createMockThresholdData,
  createMockBenjaminGrahamData,
  createMockEntryExitValuesMap,
} from '../../test/helpers';

describe('calculateScoreDetailed', () => {
  const mockThresholdData = [
    createMockThresholdData({
      industry: 'Test Industry',
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

  const mockBenjaminGrahamData = [
    createMockBenjaminGrahamData({
      ticker: 'TEST',
      companyName: 'Test Company',
      price: 100,
    }),
  ];

  describe('calculateDetailedScoreBreakdown', () => {
    it('should return correct breakdown structure', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Test Industry',
        valueCreation: 10,
        mungerQualityScore: 70,
      });

      const entryExitValues = createMockEntryExitValuesMap();
      const breakdown = calculateDetailedScoreBreakdown(
        scoreBoardData,
        mockThresholdData,
        mockBenjaminGrahamData,
        entryExitValues
      );

      expect(breakdown).toHaveProperty('totalScore');
      expect(breakdown).toHaveProperty('items');
      expect(breakdown).toHaveProperty('fundamentalTotal');
      expect(breakdown).toHaveProperty('technicalTotal');
      expect(Array.isArray(breakdown.items)).toBe(true);
    });

    it('should include all metrics in items array', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Test Industry',
      });

      const entryExitValues = createMockEntryExitValuesMap();
      const breakdown = calculateDetailedScoreBreakdown(
        scoreBoardData,
        mockThresholdData,
        mockBenjaminGrahamData,
        entryExitValues
      );

      // Should have 15 metrics total (11 fundamental + 4 technical)
      expect(breakdown.items.length).toBe(15);

      // Check that all expected metrics are present
      const metricNames = breakdown.items.map(item => item.metric);
      expect(metricNames).toContain('VALUE CREATION');
      expect(metricNames).toContain('Munger Quality Score');
      expect(metricNames).toContain('IRR');
      expect(metricNames).toContain('Ro40 F1');
      expect(metricNames).toContain('Ro40 F2');
      expect(metricNames).toContain('LEVERAGE F2');
      expect(metricNames).toContain('Cash/SDebt');
      expect(metricNames).toContain('Current Ratio');
      expect(metricNames).toContain('P/E1 INDUSTRY');
      expect(metricNames).toContain('P/E2 INDUSTRY');
      expect(metricNames).toContain('(TB/S)/Price');
      expect(metricNames).toContain('THEOENTRY');
      expect(metricNames).toContain('SMA(100)');
      expect(metricNames).toContain('SMA(200)');
      expect(metricNames).toContain('SMA CROSS');
    });

    it('should correctly categorize metrics as Fundamental or Technical', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Test Industry',
      });

      const entryExitValues = createMockEntryExitValuesMap();
      const breakdown = calculateDetailedScoreBreakdown(
        scoreBoardData,
        mockThresholdData,
        mockBenjaminGrahamData,
        entryExitValues
      );

      const fundamentalMetrics = breakdown.items.filter(item => item.category === 'Fundamental');
      const technicalMetrics = breakdown.items.filter(item => item.category === 'Technical');

      // Should have 11 fundamental metrics
      expect(fundamentalMetrics.length).toBe(11);
      // Should have 4 technical metrics (THEOENTRY, SMA(100), SMA(200), SMA CROSS)
      expect(technicalMetrics.length).toBe(4);

      // Verify specific categorizations
      expect(breakdown.items.find(item => item.metric === 'VALUE CREATION')?.category).toBe('Fundamental');
      expect(breakdown.items.find(item => item.metric === 'IRR')?.category).toBe('Fundamental');
      expect(breakdown.items.find(item => item.metric === 'THEOENTRY')?.category).toBe('Technical');
      expect(breakdown.items.find(item => item.metric === 'SMA(100)')?.category).toBe('Technical');
    });

    it('should calculate points correctly for each item', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Test Industry',
        valueCreation: 10, // GREEN
        mungerQualityScore: 70, // GREEN
      });

      const entryExitValues = createMockEntryExitValuesMap();
      const breakdown = calculateDetailedScoreBreakdown(
        scoreBoardData,
        mockThresholdData,
        mockBenjaminGrahamData,
        entryExitValues
      );

      const valueCreationItem = breakdown.items.find(item => item.metric === 'VALUE CREATION');
      expect(valueCreationItem).toBeDefined();
      expect(valueCreationItem?.weight).toBe(7);
      expect(valueCreationItem?.color).toBe('GREEN');
      expect(valueCreationItem?.factor).toBe(1.0);
      expect(valueCreationItem?.points).toBe(7.0); // 7 * 1.0

      const mungerItem = breakdown.items.find(item => item.metric === 'Munger Quality Score');
      expect(mungerItem).toBeDefined();
      expect(mungerItem?.weight).toBe(7);
      expect(mungerItem?.color).toBe('GREEN');
      expect(mungerItem?.factor).toBe(1.0);
      expect(mungerItem?.points).toBe(7.0); // 7 * 1.0
    });

    it('should calculate fundamentalTotal and technicalTotal correctly', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Test Industry',
        valueCreation: 10, // GREEN (7 points)
        mungerQualityScore: 70, // GREEN (7 points)
        irr: 30, // GREEN (6 points)
      });

      const entryExitValues = createMockEntryExitValuesMap();
      const breakdown = calculateDetailedScoreBreakdown(
        scoreBoardData,
        mockThresholdData,
        mockBenjaminGrahamData,
        entryExitValues
      );

      // Calculate expected fundamental total
      const fundamentalItems = breakdown.items.filter(item => item.category === 'Fundamental');
      const expectedFundamentalTotal = fundamentalItems.reduce((sum, item) => sum + item.points, 0);

      expect(breakdown.fundamentalTotal).toBeCloseTo(expectedFundamentalTotal, 1);

      // Calculate expected technical total
      const technicalItems = breakdown.items.filter(item => item.category === 'Technical');
      const expectedTechnicalTotal = technicalItems.reduce((sum, item) => sum + item.points, 0);

      expect(breakdown.technicalTotal).toBeCloseTo(expectedTechnicalTotal, 1);
    });

    it('should calculate totalScore as sum of fundamental and technical totals', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Test Industry',
        valueCreation: 10,
        mungerQualityScore: 70,
        irr: 30,
      });

      const entryExitValues = createMockEntryExitValuesMap();
      const breakdown = calculateDetailedScoreBreakdown(
        scoreBoardData,
        mockThresholdData,
        mockBenjaminGrahamData,
        entryExitValues
      );

      const expectedTotal = breakdown.fundamentalTotal + breakdown.technicalTotal;
      expect(breakdown.totalScore).toBeCloseTo(Math.min(100, Math.max(0, expectedTotal)), 1);
    });

    it('should handle BLUE color correctly (factor 0.70)', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Test Industry',
        mungerQualityScore: 50, // BLUE (40-60)
      });

      const entryExitValues = createMockEntryExitValuesMap();
      const breakdown = calculateDetailedScoreBreakdown(
        scoreBoardData,
        mockThresholdData,
        mockBenjaminGrahamData,
        entryExitValues
      );

      const mungerItem = breakdown.items.find(item => item.metric === 'Munger Quality Score');
      expect(mungerItem?.color).toBe('BLUE');
      expect(mungerItem?.factor).toBe(0.70);
      expect(mungerItem?.points).toBeCloseTo(7 * 0.70, 1); // 4.9
    });

    it('should handle RED color correctly (factor 0.00)', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Test Industry',
        valueCreation: -10, // RED (< 0)
      });

      const entryExitValues = createMockEntryExitValuesMap();
      const breakdown = calculateDetailedScoreBreakdown(
        scoreBoardData,
        mockThresholdData,
        mockBenjaminGrahamData,
        entryExitValues
      );

      const valueCreationItem = breakdown.items.find(item => item.metric === 'VALUE CREATION');
      expect(valueCreationItem?.color).toBe('RED');
      expect(valueCreationItem?.factor).toBe(0.00);
      expect(valueCreationItem?.points).toBe(0.0);
    });

    it('should handle BLANK color correctly (factor 0.00)', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Test Industry',
        valueCreation: null, // BLANK
      });

      const entryExitValues = createMockEntryExitValuesMap();
      const breakdown = calculateDetailedScoreBreakdown(
        scoreBoardData,
        mockThresholdData,
        mockBenjaminGrahamData,
        entryExitValues
      );

      const valueCreationItem = breakdown.items.find(item => item.metric === 'VALUE CREATION');
      expect(valueCreationItem?.color).toBe('BLANK');
      expect(valueCreationItem?.factor).toBe(0.00);
      expect(valueCreationItem?.points).toBe(0.0);
    });

    it('should handle THEOENTRY correctly (GreenOnly method)', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Test Industry',
        sma100: 90,
        sma200: 80,
      });

      const entryExitValues = createMockEntryExitValuesMap([
        {
          ticker: 'TEST',
          companyName: 'Test Company',
          values: {
            entry1: 100,
            exit1: 160, // RR1 = 60%
          },
        },
      ]);

      const benjaminGrahamData = [
        createMockBenjaminGrahamData({
          ticker: 'TEST',
          companyName: 'Test Company',
          price: 100, // Price <= Entry1 * 1.05
        }),
      ];

      const breakdown = calculateDetailedScoreBreakdown(
        scoreBoardData,
        mockThresholdData,
        benjaminGrahamData,
        entryExitValues
      );

      const theoEntryItem = breakdown.items.find(item => item.metric === 'THEOENTRY');
      expect(theoEntryItem).toBeDefined();
      expect(theoEntryItem?.color).toBe('GREEN');
      expect(theoEntryItem?.weight).toBe(40);
      expect(theoEntryItem?.factor).toBe(1.0);
      expect(theoEntryItem?.points).toBe(40.0);
    });

    it('should handle THEOENTRY as BLANK when conditions not met', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Test Industry',
      });

      const entryExitValues = createMockEntryExitValuesMap(); // No entry/exit values
      const breakdown = calculateDetailedScoreBreakdown(
        scoreBoardData,
        mockThresholdData,
        mockBenjaminGrahamData,
        entryExitValues
      );

      const theoEntryItem = breakdown.items.find(item => item.metric === 'THEOENTRY');
      expect(theoEntryItem?.color).toBe('BLANK');
      expect(theoEntryItem?.points).toBe(0.0);
    });

    it('should round totals to 1 decimal place', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Test Industry',
        mungerQualityScore: 50, // BLUE (0.70 factor)
      });

      const entryExitValues = createMockEntryExitValuesMap();
      const breakdown = calculateDetailedScoreBreakdown(
        scoreBoardData,
        mockThresholdData,
        mockBenjaminGrahamData,
        entryExitValues
      );

      // Check that totals are rounded to 1 decimal
      const fundamentalDecimalPlaces = (breakdown.fundamentalTotal.toString().split('.')[1] || '').length;
      const technicalDecimalPlaces = (breakdown.technicalTotal.toString().split('.')[1] || '').length;
      const totalDecimalPlaces = (breakdown.totalScore.toString().split('.')[1] || '').length;

      expect(fundamentalDecimalPlaces).toBeLessThanOrEqual(1);
      expect(technicalDecimalPlaces).toBeLessThanOrEqual(1);
      expect(totalDecimalPlaces).toBeLessThanOrEqual(1);
    });
  });

  describe('calculateDetailedScore', () => {
    it('should return a score between 0 and 100', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Test Industry',
        valueCreation: 10,
        mungerQualityScore: 70,
      });

      const entryExitValues = createMockEntryExitValuesMap();
      const score = calculateDetailedScore(
        scoreBoardData,
        mockThresholdData,
        mockBenjaminGrahamData,
        entryExitValues
      );

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should return same total as breakdown totalScore', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Test Industry',
        valueCreation: 10,
        mungerQualityScore: 70,
        irr: 30,
      });

      const entryExitValues = createMockEntryExitValuesMap();
      const breakdown = calculateDetailedScoreBreakdown(
        scoreBoardData,
        mockThresholdData,
        mockBenjaminGrahamData,
        entryExitValues
      );
      const score = calculateDetailedScore(
        scoreBoardData,
        mockThresholdData,
        mockBenjaminGrahamData,
        entryExitValues
      );

      expect(score).toBeCloseTo(breakdown.totalScore, 1);
    });

    it('should round score to 1 decimal place', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Test Industry',
        mungerQualityScore: 50, // BLUE (0.70 factor)
      });

      const entryExitValues = createMockEntryExitValuesMap();
      const score = calculateDetailedScore(
        scoreBoardData,
        mockThresholdData,
        mockBenjaminGrahamData,
        entryExitValues
      );

      const decimalPlaces = (score.toString().split('.')[1] || '').length;
      expect(decimalPlaces).toBeLessThanOrEqual(1);
    });
  });

  describe('Edge cases', () => {
    it('should handle missing industry in threshold data', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Unknown Industry',
        irr: 30,
      });

      const entryExitValues = createMockEntryExitValuesMap();
      const breakdown = calculateDetailedScoreBreakdown(
        scoreBoardData,
        mockThresholdData,
        mockBenjaminGrahamData,
        entryExitValues
      );

      const irrItem = breakdown.items.find(item => item.metric === 'IRR');
      expect(irrItem?.color).toBe('BLANK');
      expect(irrItem?.points).toBe(0.0);
    });

    it('should handle empty arrays', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Test Industry',
      });

      const breakdown = calculateDetailedScoreBreakdown(
        scoreBoardData,
        [],
        [],
        new Map()
      );

      // Should still return breakdown structure
      expect(breakdown).toHaveProperty('totalScore');
      expect(breakdown).toHaveProperty('items');
      expect(breakdown.items.length).toBe(15);
    });

    it('should handle isCashSdebtDivZero special case', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Test Industry',
        cashSdebt: null,
        isCashSdebtDivZero: true,
      });

      const entryExitValues = createMockEntryExitValuesMap();
      const breakdown = calculateDetailedScoreBreakdown(
        scoreBoardData,
        mockThresholdData,
        mockBenjaminGrahamData,
        entryExitValues
      );

      const cashSdebtItem = breakdown.items.find(item => item.metric === 'Cash/SDebt');
      expect(cashSdebtItem?.color).toBe('GREEN');
      expect(cashSdebtItem?.points).toBe(5.0); // 5 * 1.0
    });
  });
});

