import { describe, it, expect } from 'vitest';
import {
  getMungerQualityScoreColor,
  getValueCreationColor,
  getLeverageF2Color,
  getCashSdebtColor,
  getCurrentRatioColor,
  getPEPercentageColor,
  getSMAColor,
} from '../colorLogic';
import type { IndustryThresholdData } from '../../../types/stock';

describe('colorThresholds colorLogic', () => {
  const thresholdData: IndustryThresholdData[] = [
    {
      industryKey: 'test',
      industry: 'Test Industry',
      leverageF2Min: 2.0,
      leverageF2Max: 3.0,
      cashSdebtMin: 0.7,
      cashSdebtMax: 1.2,
      currentRatioMin: 1.1,
      currentRatioMax: 2.0,
    },
  ];

  describe('getMungerQualityScoreColor', () => {
    it('returns RED when < 40', () => {
      expect(getMungerQualityScoreColor(30)).toBe('RED');
    });
    it('returns ORANGE when 40-60', () => {
      expect(getMungerQualityScoreColor(50)).toBe('ORANGE');
    });
    it('returns GREEN when >= 60', () => {
      expect(getMungerQualityScoreColor(70)).toBe('GREEN');
    });
    it('returns BLANK for null', () => {
      expect(getMungerQualityScoreColor(null)).toBe('BLANK');
    });
  });

  describe('getValueCreationColor', () => {
    it('returns GREEN when >= 0', () => expect(getValueCreationColor(10)).toBe('GREEN'));
    it('returns RED when < 0', () => expect(getValueCreationColor(-5)).toBe('RED'));
    it('returns BLANK for null', () => expect(getValueCreationColor(null)).toBe('BLANK'));
  });

  describe('getLeverageF2Color', () => {
    it('returns GREEN when <= min (2.0)', () => {
      expect(getLeverageF2Color(1.5, 'Test Industry', thresholdData)).toBe('GREEN');
    });
    it('returns ORANGE when between min and max', () => {
      expect(getLeverageF2Color(2.5, 'Test Industry', thresholdData)).toBe('ORANGE');
    });
    it('returns RED when > max (3.0)', () => {
      expect(getLeverageF2Color(4.0, 'Test Industry', thresholdData)).toBe('RED');
    });
  });

  describe('getCashSdebtColor', () => {
    it('returns GREEN when isDivZero', () => {
      expect(getCashSdebtColor(null, true, 'Test Industry', thresholdData)).toBe('GREEN');
    });
    it('returns RED when <= min', () => {
      expect(getCashSdebtColor(0.5, false, 'Test Industry', thresholdData)).toBe('RED');
    });
    it('returns GREEN when >= max', () => {
      expect(getCashSdebtColor(1.5, false, 'Test Industry', thresholdData)).toBe('GREEN');
    });
    it('returns ORANGE when between', () => {
      expect(getCashSdebtColor(0.9, false, 'Test Industry', thresholdData)).toBe('ORANGE');
    });
  });

  describe('getCurrentRatioColor', () => {
    it('returns RED when < min', () => {
      expect(getCurrentRatioColor(0.8, 'Test Industry', thresholdData)).toBe('RED');
    });
    it('returns GREEN when min <= x < max', () => {
      expect(getCurrentRatioColor(1.5, 'Test Industry', thresholdData)).toBe('GREEN');
    });
    it('returns ORANGE when >= max', () => {
      expect(getCurrentRatioColor(2.5, 'Test Industry', thresholdData)).toBe('ORANGE');
    });
  });

  describe('getPEPercentageColor', () => {
    it('returns GREEN when <= 0', () => expect(getPEPercentageColor(-5)).toBe('GREEN'));
    it('returns RED when > 0', () => expect(getPEPercentageColor(5)).toBe('RED'));
  });

  describe('getSMAColor', () => {
    it('returns GREEN when price > sma', () => expect(getSMAColor(100, 90)).toBe('GREEN'));
    it('returns RED when price < sma', () => expect(getSMAColor(80, 90)).toBe('RED'));
    it('returns ORANGE when price === sma', () => expect(getSMAColor(100, 100)).toBe('ORANGE'));
    it('returns BLANK for null', () => expect(getSMAColor(null, 90)).toBe('BLANK'));
  });
});
