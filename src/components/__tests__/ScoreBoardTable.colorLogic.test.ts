import { describe, it, expect } from 'vitest';
import {
  getCurrentRatioColor,
  getCashSdebtColor,
  getRo40Color,
  getIRRColor,
  getLeverageF2Color,
  getTBSPPriceColor,
  getSMAColor,
  colorTypeToCssClass,
  COLORS,
} from '../../utils/colorThresholds';
import type { ColorType } from '../../utils/colorThresholds';
import { ThresholdIndustryData } from '../../types/stock';
import { createMockThresholdData } from '../../test/helpers';

describe('Color Logic Functions (ScoreBoardTable integration)', () => {
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

  const toCss = (color: ColorType, opts?: { orangeVariant?: 'blue' | 'yellow' }) =>
    colorTypeToCssClass(color, opts);

  describe('getCurrentRatioColor', () => {
    it('should return green for value >= min && < max', () => {
      expect(toCss(getCurrentRatioColor(1.5, 'Test Industry', mockThresholdData))).toBe(COLORS.green);
      expect(toCss(getCurrentRatioColor(1.1, 'Test Industry', mockThresholdData))).toBe(COLORS.green);
      expect(toCss(getCurrentRatioColor(1.99, 'Test Industry', mockThresholdData))).toBe(COLORS.green);
    });

    it('should return red for value < min', () => {
      expect(toCss(getCurrentRatioColor(0.8, 'Test Industry', mockThresholdData))).toBe(COLORS.red);
      expect(toCss(getCurrentRatioColor(0.5, 'Test Industry', mockThresholdData))).toBe(COLORS.red);
    });

    it('should return blue (ORANGE) for value >= max', () => {
      expect(toCss(getCurrentRatioColor(2.0, 'Test Industry', mockThresholdData))).toBe(COLORS.blue);
      expect(toCss(getCurrentRatioColor(2.5, 'Test Industry', mockThresholdData))).toBe(COLORS.blue);
    });

    it('should return null for null value', () => {
      expect(toCss(getCurrentRatioColor(null, 'Test Industry', mockThresholdData))).toBeNull();
    });
  });

  describe('getCashSdebtColor', () => {
    it('should return green for isDivZero = true', () => {
      expect(toCss(getCashSdebtColor(null, true, 'Test Industry', mockThresholdData))).toBe(COLORS.green);
    });

    it('should return green for value >= max', () => {
      expect(toCss(getCashSdebtColor(1.2, false, 'Test Industry', mockThresholdData))).toBe(COLORS.green);
      expect(toCss(getCashSdebtColor(1.5, false, 'Test Industry', mockThresholdData))).toBe(COLORS.green);
    });

    it('should return red for value <= min', () => {
      expect(toCss(getCashSdebtColor(0.7, false, 'Test Industry', mockThresholdData))).toBe(COLORS.red);
      expect(toCss(getCashSdebtColor(0.5, false, 'Test Industry', mockThresholdData))).toBe(COLORS.red);
    });

    it('should return blue for value between min and max', () => {
      expect(toCss(getCashSdebtColor(0.9, false, 'Test Industry', mockThresholdData))).toBe(COLORS.blue);
      expect(toCss(getCashSdebtColor(1.0, false, 'Test Industry', mockThresholdData))).toBe(COLORS.blue);
    });

    it('should return null for null value when isDivZero is false', () => {
      expect(toCss(getCashSdebtColor(null, false, 'Test Industry', mockThresholdData))).toBeNull();
    });
  });

  describe('getRo40Color', () => {
    it('should transform percentage to decimal and return green for >= max', () => {
      expect(toCss(getRo40Color(30, 'Test Industry', mockThresholdData))).toBe(COLORS.green);
    });

    it('should transform percentage to decimal and return red for <= min', () => {
      expect(toCss(getRo40Color(10, 'Test Industry', mockThresholdData))).toBe(COLORS.red);
    });

    it('should transform percentage to decimal and return blue for between min and max', () => {
      expect(toCss(getRo40Color(20, 'Test Industry', mockThresholdData))).toBe(COLORS.blue);
    });

    it('should return null for null value', () => {
      expect(toCss(getRo40Color(null, 'Test Industry', mockThresholdData))).toBeNull();
    });
  });

  describe('getIRRColor', () => {
    it('should return green for value >= threshold', () => {
      expect(toCss(getIRRColor(30, 'Test Industry', mockThresholdData))).toBe(COLORS.green);
      expect(toCss(getIRRColor(25, 'Test Industry', mockThresholdData))).toBe(COLORS.green);
    });

    it('should return red for value < threshold', () => {
      expect(toCss(getIRRColor(20, 'Test Industry', mockThresholdData))).toBe(COLORS.red);
    });

    it('should return null for null value', () => {
      expect(toCss(getIRRColor(null, 'Test Industry', mockThresholdData))).toBeNull();
    });
  });

  describe('getLeverageF2Color', () => {
    it('should return green for value <= min (inverted)', () => {
      expect(toCss(getLeverageF2Color(2.0, 'Test Industry', mockThresholdData))).toBe(COLORS.green);
      expect(toCss(getLeverageF2Color(1.5, 'Test Industry', mockThresholdData))).toBe(COLORS.green);
    });

    it('should return blue for value <= max (inverted)', () => {
      expect(toCss(getLeverageF2Color(3.0, 'Test Industry', mockThresholdData))).toBe(COLORS.blue);
      expect(toCss(getLeverageF2Color(2.5, 'Test Industry', mockThresholdData))).toBe(COLORS.blue);
    });

    it('should return red for value > max (inverted)', () => {
      expect(toCss(getLeverageF2Color(3.5, 'Test Industry', mockThresholdData))).toBe(COLORS.red);
    });

    it('should return null for null value', () => {
      expect(toCss(getLeverageF2Color(null, 'Test Industry', mockThresholdData))).toBeNull();
    });
  });

  describe('getTBSPPriceColor', () => {
    it('should return green for value >= 1.00', () => {
      expect(toCss(getTBSPPriceColor(1.0))).toBe(COLORS.green);
      expect(toCss(getTBSPPriceColor(1.5))).toBe(COLORS.green);
    });

    it('should return red for value < 1.00', () => {
      expect(toCss(getTBSPPriceColor(0.9))).toBe(COLORS.red);
      expect(toCss(getTBSPPriceColor(0.5))).toBe(COLORS.red);
    });

    it('should return null for null value', () => {
      expect(toCss(getTBSPPriceColor(null))).toBeNull();
    });
  });

  describe('getSMAColor', () => {
    it('should return green when price > smaValue', () => {
      expect(toCss(getSMAColor(100, 90))).toBe(COLORS.green);
    });

    it('should return red when price < smaValue', () => {
      expect(toCss(getSMAColor(80, 90))).toBe(COLORS.red);
    });

    it('should return yellow when price === smaValue (orangeVariant yellow)', () => {
      expect(colorTypeToCssClass(getSMAColor(100, 100), { orangeVariant: 'yellow' })).toBe(COLORS.yellow);
    });

    it('should return null when price is null', () => {
      expect(toCss(getSMAColor(null, 90))).toBeNull();
    });

    it('should return null when smaValue is null', () => {
      expect(toCss(getSMAColor(100, null))).toBeNull();
    });

    it('should return null when both are null', () => {
      expect(toCss(getSMAColor(null, null))).toBeNull();
    });

    it('should return null when price is undefined', () => {
      expect(toCss(getSMAColor(undefined, 90))).toBeNull();
    });
  });
});
