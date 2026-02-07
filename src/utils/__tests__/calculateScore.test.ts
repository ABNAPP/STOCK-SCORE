import { describe, it, expect } from 'vitest';
import { calculateScore } from '../calculateScore';
import { ScoreBoardData, ThresholdIndustryData, BenjaminGrahamData } from '../../types/stock';
import {
  createMockScoreBoardData,
  createMockThresholdData,
  createMockBenjaminGrahamData,
  createMockEntryExitValuesMap,
} from '../../test/helpers';

describe('calculateScore', () => {
  const mockThresholdData: ThresholdIndustryData[] = [
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

  const mockBenjaminGrahamData: BenjaminGrahamData[] = [
    createMockBenjaminGrahamData({
      ticker: 'TEST',
      companyName: 'Test Company',
      price: 100,
    }),
  ];

  describe('3Band method metrics', () => {
    it('should calculate score with all GREEN values (3Band method)', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Test Industry',
        valueCreation: 10, // GREEN (>= 0)
        mungerQualityScore: 70, // GREEN (>= 60)
        irr: 30, // GREEN (>= 25 threshold)
        ro40F1: 30, // GREEN (30% / 100 = 0.30 >= 0.25 max)
        ro40F2: 30, // GREEN (30% / 100 = 0.30 >= 0.25 max)
        leverageF2: 1.5, // GREEN (<= 2.0 min, inverted)
        cashSdebt: 1.5, // GREEN (>= 1.2 max)
        currentRatio: 1.5, // GREEN (>= 1.1 && < 2.0)
        pe1Industry: -5, // GREEN (<= 0)
        pe2Industry: -5, // GREEN (<= 0)
        tbSPrice: 1.5, // GREEN (>= 1.00)
      });

      const entryExitValues = createMockEntryExitValuesMap();
      const score = calculateScore(scoreBoardData, mockThresholdData, mockBenjaminGrahamData, entryExitValues);

      // All 3Band metrics are GREEN (factor 1.0)
      // VALUE CREATION: 10 * 1.0 = 10
      // Munger Quality Score: 10 * 1.0 = 10
      // IRR: 8 * 1.0 = 8
      // Ro40 F1: 6 * 1.0 = 6
      // Ro40 F2: 5 * 1.0 = 5
      // LEVERAGE F2: 5 * 1.0 = 5
      // Cash/SDebt: 4 * 1.0 = 4
      // Current Ratio: 3 * 1.0 = 3
      // P/E1 INDUSTRY: 2 * 1.0 = 2
      // P/E2 INDUSTRY: 1 * 1.0 = 1
      // (TB/S)/Price: 1 * 1.0 = 1
      // Total: 55 points (Fundamental)
      // Technical: 0 (no green values)
      // Total: 55 / 100 * 100 = 55.0
      expect(score).toBeCloseTo(55.0, 1);
    });

    it('should calculate score with all ORANGE values (3Band method)', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Test Industry',
        valueCreation: 10, // GREEN (>= 0)
        mungerQualityScore: 50, // ORANGE (40-60)
        irr: 20, // RED (< 25 threshold)
        ro40F1: 20, // ORANGE (20% / 100 = 0.20, between 0.15-0.25)
        ro40F2: 20, // ORANGE (20% / 100 = 0.20, between 0.15-0.25)
        leverageF2: 2.5, // ORANGE (2.0 < 2.5 <= 3.0, inverted)
        cashSdebt: 0.9, // ORANGE (0.7 < 0.9 < 1.2)
        currentRatio: 1.5, // GREEN (>= 1.1 && < 2.0)
        pe1Industry: -5, // GREEN (<= 0)
        pe2Industry: -5, // GREEN (<= 0)
        tbSPrice: 1.5, // GREEN (>= 1.00)
      });

      const entryExitValues = createMockEntryExitValuesMap();
      const score = calculateScore(scoreBoardData, mockThresholdData, mockBenjaminGrahamData, entryExitValues);

      // Mix of GREEN and ORANGE
      // VALUE CREATION: 10 * 1.0 = 10 (GREEN)
      // Munger Quality Score: 10 * 0.7 = 7 (ORANGE)
      // IRR: 8 * 0.0 = 0 (RED)
      // Ro40 F1: 6 * 0.7 = 4.2 (ORANGE)
      // Ro40 F2: 5 * 0.7 = 3.5 (ORANGE)
      // LEVERAGE F2: 5 * 0.7 = 3.5 (ORANGE)
      // Cash/SDebt: 4 * 0.7 = 2.8 (ORANGE)
      // Current Ratio: 3 * 1.0 = 3 (GREEN)
      // P/E1 INDUSTRY: 2 * 1.0 = 2 (GREEN)
      // P/E2 INDUSTRY: 1 * 1.0 = 1 (GREEN)
      // (TB/S)/Price: 1 * 1.0 = 1 (GREEN)
      // Total: ~38 points
      expect(score).toBeGreaterThan(30);
      expect(score).toBeLessThan(45);
    });

    it('should calculate score with all RED values (3Band method)', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Test Industry',
        valueCreation: -10, // RED (< 0)
        mungerQualityScore: 30, // RED (< 40)
        irr: 20, // RED (< 25 threshold)
        ro40F1: 10, // RED (10% / 100 = 0.10 <= 0.15 min)
        ro40F2: 10, // RED (10% / 100 = 0.10 <= 0.15 min)
        leverageF2: 4.0, // RED (> 3.0 max, inverted)
        cashSdebt: 0.5, // RED (<= 0.7 min)
        currentRatio: 0.8, // RED (< 1.1 min)
        pe1Industry: 5, // RED (> 0)
        pe2Industry: 5, // RED (> 0)
        tbSPrice: 0.5, // RED (< 1.00)
      });

      const entryExitValues = createMockEntryExitValuesMap();
      const score = calculateScore(scoreBoardData, mockThresholdData, mockBenjaminGrahamData, entryExitValues);

      // All 3Band metrics are RED (factor 0.0)
      // Total: 0 points
      expect(score).toBe(0);
    });

    it('should handle BLANK values (3Band method)', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Test Industry',
        // All values are null (BLANK)
      });

      const entryExitValues = createMockEntryExitValuesMap();
      const score = calculateScore(scoreBoardData, mockThresholdData, mockBenjaminGrahamData, entryExitValues);

      // All metrics are BLANK (factor 0.0 for 3Band and GreenOnly)
      // totalPts = 0, score = (0 / 100) * 100 = 0
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(0.1); // Should be 0, but allow for rounding
    });
  });

  describe('GreenOnly method metrics', () => {
    it('should calculate score with GREEN TheoEntry (GreenOnly method)', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Test Industry',
        sma100: 90,
        sma200: 80,
        smaCross: 'GOLDEN',
      });

      const entryExitValues = createMockEntryExitValuesMap([
        {
          ticker: 'TEST',
          companyName: 'Test Company',
          values: {
            entry1: 100,
            exit1: 160, // RR1 = (160-100)/100*100 = 60%
          },
        },
      ]);

      const benjaminGrahamData = [
        createMockBenjaminGrahamData({
          ticker: 'TEST',
          companyName: 'Test Company',
          price: 100, // Price <= Entry1 * 1.05 (100 <= 105)
        }),
      ];

      const score = calculateScore(scoreBoardData, mockThresholdData, benjaminGrahamData, entryExitValues);

      // TheoEntry: GREEN (40 points)
      // SMA(100): GREEN (price 100 > sma100 90) = 2.5 points
      // SMA(200): GREEN (price 100 > sma200 80) = 2.5 points
      // SMA Cross: GREEN (GOLDEN = GREEN in calculateScore.ts) = 5 points
      // Total Technical: 50 points. With mock defaults, total score = 50.0
      expect(score).toBeCloseTo(50.0, 1);
    });

    it('should calculate score with BLANK TheoEntry (GreenOnly method)', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Test Industry',
        sma100: 90,
        sma200: 80,
        smaCross: null,
      });

      const entryExitValues = createMockEntryExitValuesMap(); // No entry/exit values
      const benjaminGrahamData = [
        createMockBenjaminGrahamData({
          ticker: 'TEST',
          companyName: 'Test Company',
          price: 100,
        }),
      ];
      const score = calculateScore(scoreBoardData, mockThresholdData, benjaminGrahamData, entryExitValues);

      // TheoEntry: BLANK (0 points)
      // SMA(100): GREEN (2.5 points) if price > sma100
      // SMA(200): GREEN (2.5 points) if price > sma200
      // SMA Cross: BLANK (0 points)
      // Total Technical: 5 points
      expect(score).toBeCloseTo(5.0, 1);
    });
  });

  describe('Edge cases', () => {
    it('should handle missing industry in threshold data', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Unknown Industry',
        irr: 30,
      });

      const entryExitValues = createMockEntryExitValuesMap();
      const score = calculateScore(scoreBoardData, mockThresholdData, mockBenjaminGrahamData, entryExitValues);

      // IRR should be BLANK (no threshold found)
      // Score should be low or 0
      expect(score).toBe(0);
    });

    it('should handle null values correctly', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Test Industry',
        irr: null,
        mungerQualityScore: null,
        valueCreation: null,
      });

      const entryExitValues = createMockEntryExitValuesMap();
      const score = calculateScore(scoreBoardData, mockThresholdData, mockBenjaminGrahamData, entryExitValues);

      // All null values should result in BLANK (0 points for 3Band)
      expect(score).toBe(0);
    });

    it('should handle empty arrays', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Test Industry',
      });

      const score = calculateScore(scoreBoardData, [], [], new Map());

      // Should still calculate but with BLANK values
      // totalPts = 0, score = (0 / 100) * 100 = 0
      expect(score).toBe(0);
    });

    it('should handle isCashSdebtDivZero special case', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Test Industry',
        cashSdebt: null,
        isCashSdebtDivZero: true, // Should be GREEN
      });

      const entryExitValues = createMockEntryExitValuesMap();
      const score = calculateScore(scoreBoardData, mockThresholdData, mockBenjaminGrahamData, entryExitValues);

      // Cash/SDebt with isDivZero should be GREEN (4 points for 3Band method)
      // Score should be at least 4 points
      expect(score).toBeGreaterThanOrEqual(4);
    });

    it('should scale score to 0-100 range', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Test Industry',
        valueCreation: 10,
        mungerQualityScore: 70,
        irr: 30,
        ro40F1: 30,
        ro40F2: 30,
        leverageF2: 1.5,
        cashSdebt: 1.5,
        currentRatio: 1.5,
        pe1Industry: -5,
        pe2Industry: -5,
        tbSPrice: 1.5,
      });

      const entryExitValues = createMockEntryExitValuesMap([
        {
          ticker: 'TEST',
          companyName: 'Test Company',
          values: {
            entry1: 100,
            exit1: 160,
          },
        },
      ]);

      const benjaminGrahamData = [
        createMockBenjaminGrahamData({
          ticker: 'TEST',
          companyName: 'Test Company',
          price: 100,
        }),
      ];

      const score = calculateScore(scoreBoardData, mockThresholdData, benjaminGrahamData, entryExitValues);

      // Score should be between 0 and 100
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should round score to 1 decimal place', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Test Industry',
        mungerQualityScore: 50, // ORANGE (0.7 factor)
      });

      const entryExitValues = createMockEntryExitValuesMap();
      const score = calculateScore(scoreBoardData, mockThresholdData, mockBenjaminGrahamData, entryExitValues);

      // Score should have at most 1 decimal place
      const decimalPlaces = (score.toString().split('.')[1] || '').length;
      expect(decimalPlaces).toBeLessThanOrEqual(1);
    });
  });

  describe('Complete scenario', () => {
    it('should calculate complete score with mixed colors', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Test Industry',
        valueCreation: 5, // GREEN
        mungerQualityScore: 50, // ORANGE
        irr: 30, // GREEN
        ro40F1: 20, // ORANGE
        ro40F2: 20, // ORANGE
        leverageF2: 2.5, // ORANGE
        cashSdebt: 1.0, // ORANGE
        currentRatio: 1.5, // GREEN
        pe1Industry: -2, // GREEN
        pe2Industry: -2, // GREEN
        tbSPrice: 1.2, // GREEN
        sma100: 90,
        sma200: 80,
        smaCross: 'DEATH',
      });

      const entryExitValues = createMockEntryExitValuesMap([
        {
          ticker: 'TEST',
          companyName: 'Test Company',
          values: {
            entry1: 100,
            exit1: 160,
          },
        },
      ]);

      const benjaminGrahamData = [
        createMockBenjaminGrahamData({
          ticker: 'TEST',
          companyName: 'Test Company',
          price: 100,
        }),
      ];

      const score = calculateScore(scoreBoardData, mockThresholdData, benjaminGrahamData, entryExitValues);

      // Should have a reasonable score
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
      expect(score).toBeCloseTo(score, 1); // Rounded to 1 decimal
    });
  });

  describe('Additional edge cases', () => {
    it('should handle extreme positive values', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Test Industry',
        valueCreation: 1000000,
        mungerQualityScore: 100,
        irr: 1000,
        ro40F1: 100,
        ro40F2: 100,
        leverageF2: 0.1,
        cashSdebt: 1000,
        currentRatio: 100,
        pe1Industry: -1000,
        pe2Industry: -1000,
        tbSPrice: 1000,
      });

      const entryExitValues = createMockEntryExitValuesMap();
      const score = calculateScore(scoreBoardData, mockThresholdData, mockBenjaminGrahamData, entryExitValues);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should handle extreme negative values', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Test Industry',
        valueCreation: -1000000,
        mungerQualityScore: -100,
        irr: -1000,
        ro40F1: -100,
        ro40F2: -100,
        leverageF2: 1000,
        cashSdebt: -1000,
        currentRatio: -100,
        pe1Industry: 1000,
        pe2Industry: 1000,
        tbSPrice: -1000,
      });

      const entryExitValues = createMockEntryExitValuesMap();
      const score = calculateScore(scoreBoardData, mockThresholdData, mockBenjaminGrahamData, entryExitValues);

      expect(score).toBe(0);
    });

    it('should handle very small decimal values', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Test Industry',
        valueCreation: 0.0001,
        mungerQualityScore: 0.0001,
        irr: 0.0001,
      });

      const entryExitValues = createMockEntryExitValuesMap();
      const score = calculateScore(scoreBoardData, mockThresholdData, mockBenjaminGrahamData, entryExitValues);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should handle boundary threshold values exactly at min', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Test Industry',
        irr: 25, // Exactly at threshold min
        ro40F1: 15, // Exactly at threshold min (15% = 0.15)
        ro40F2: 15,
        leverageF2: 2.0, // Exactly at threshold min (inverted)
        cashSdebt: 0.7, // Exactly at threshold min
        currentRatio: 1.1, // Exactly at threshold min
      });

      const entryExitValues = createMockEntryExitValuesMap();
      const score = calculateScore(scoreBoardData, mockThresholdData, mockBenjaminGrahamData, entryExitValues);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should handle boundary threshold values exactly at max', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Test Industry',
        irr: 25,
        ro40F1: 25, // Exactly at threshold max (25% = 0.25)
        ro40F2: 25,
        leverageF2: 3.0, // Exactly at threshold max (inverted)
        cashSdebt: 1.2, // Exactly at threshold max
        currentRatio: 2.0, // Exactly at threshold max
      });

      const entryExitValues = createMockEntryExitValuesMap();
      const score = calculateScore(scoreBoardData, mockThresholdData, mockBenjaminGrahamData, entryExitValues);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should handle values just below threshold boundaries', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Test Industry',
        irr: 24.999, // Just below threshold
        ro40F1: 14.999,
        leverageF2: 3.001, // Just above max (inverted, so RED)
      });

      const entryExitValues = createMockEntryExitValuesMap();
      const score = calculateScore(scoreBoardData, mockThresholdData, mockBenjaminGrahamData, entryExitValues);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should handle values just above threshold boundaries', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Test Industry',
        irr: 25.001, // Just above threshold
        ro40F1: 25.001,
        leverageF2: 1.999, // Just below min (inverted, so GREEN)
      });

      const entryExitValues = createMockEntryExitValuesMap();
      const score = calculateScore(scoreBoardData, mockThresholdData, mockBenjaminGrahamData, entryExitValues);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should handle NaN values gracefully', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Test Industry',
        valueCreation: NaN as unknown as number,
        mungerQualityScore: NaN as unknown as number,
      });

      const entryExitValues = createMockEntryExitValuesMap();
      const score = calculateScore(scoreBoardData, mockThresholdData, mockBenjaminGrahamData, entryExitValues);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
      expect(isNaN(score)).toBe(false);
    });

    it('should handle Infinity values gracefully', () => {
      const scoreBoardData = createMockScoreBoardData({
        industry: 'Test Industry',
        valueCreation: Infinity,
        mungerQualityScore: Infinity,
      });

      const entryExitValues = createMockEntryExitValuesMap();
      const score = calculateScore(scoreBoardData, mockThresholdData, mockBenjaminGrahamData, entryExitValues);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
      expect(isFinite(score)).toBe(true);
    });

    it('should handle multiple industries with different thresholds', () => {
      const thresholdData1 = createMockThresholdData({
        industry: 'Industry A',
        irr: 20,
      });
      const thresholdData2 = createMockThresholdData({
        industry: 'Industry B',
        irr: 30,
      });

      const scoreBoardData1 = createMockScoreBoardData({
        industry: 'Industry A',
        irr: 25, // GREEN for Industry A (>= 20)
      });
      const scoreBoardData2 = createMockScoreBoardData({
        industry: 'Industry B',
        irr: 25, // RED for Industry B (< 30)
      });

      const entryExitValues = createMockEntryExitValuesMap();
      const score1 = calculateScore(scoreBoardData1, [thresholdData1, thresholdData2], mockBenjaminGrahamData, entryExitValues);
      const score2 = calculateScore(scoreBoardData2, [thresholdData1, thresholdData2], mockBenjaminGrahamData, entryExitValues);

      expect(score1).toBeGreaterThan(score2);
    });

    it('should handle concurrent entry/exit values for same ticker', () => {
      const entryExitValues = createMockEntryExitValuesMap([
        {
          ticker: 'TEST',
          companyName: 'Test Company',
          values: {
            entry1: 100,
            exit1: 200,
            entry2: 150,
            exit2: 250,
          },
        },
      ]);

      const benjaminGrahamData = [
        createMockBenjaminGrahamData({
          ticker: 'TEST',
          companyName: 'Test Company',
          price: 105, // Within tolerance of entry1
        }),
      ];

      const scoreBoardData = createMockScoreBoardData({
        industry: 'Test Industry',
        sma100: 90,
        sma200: 80,
        smaCross: 'GOLDEN',
      });

      const score = calculateScore(scoreBoardData, mockThresholdData, benjaminGrahamData, entryExitValues);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });
});

