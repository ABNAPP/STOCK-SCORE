import { describe, it, expect } from 'vitest';
import {
  getColorByThreshold,
  getCurrentRatioColor,
  getCashSdebtColor,
  getRo40Color,
  getIRRColor,
  getLeverageF2Color,
  getTBSPPriceColor,
  getSMAColor,
  ThresholdColorConfig,
} from '../ScoreBoardTable';
import { ThresholdIndustryData } from '../../types/stock';
import { createMockThresholdData } from '../../test/helpers';

describe('Color Logic Functions', () => {
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

  describe('getColorByThreshold', () => {
    describe('Normal mode - min/max range', () => {
      it('should return green for currentRatio >= min && < max', () => {
        const config: ThresholdColorConfig = {
          industry: 'Test Industry',
          thresholdData: mockThresholdData,
          minKey: 'currentRatioMin',
          maxKey: 'currentRatioMax',
          comparisonMode: 'normal',
        };

        expect(getColorByThreshold(1.5, config)).toBe('text-green-600 dark:text-green-400');
        expect(getColorByThreshold(1.1, config)).toBe('text-green-600 dark:text-green-400');
        expect(getColorByThreshold(1.99, config)).toBe('text-green-600 dark:text-green-400');
      });

      it('should return red for currentRatio < min', () => {
        const config: ThresholdColorConfig = {
          industry: 'Test Industry',
          thresholdData: mockThresholdData,
          minKey: 'currentRatioMin',
          maxKey: 'currentRatioMax',
          comparisonMode: 'normal',
        };

        expect(getColorByThreshold(0.8, config)).toBe('text-red-700 dark:text-red-500');
        expect(getColorByThreshold(1.0, config)).toBe('text-red-700 dark:text-red-500');
      });

      it('should return blue for currentRatio >= max', () => {
        const config: ThresholdColorConfig = {
          industry: 'Test Industry',
          thresholdData: mockThresholdData,
          minKey: 'currentRatioMin',
          maxKey: 'currentRatioMax',
          comparisonMode: 'normal',
        };

        expect(getColorByThreshold(2.0, config)).toBe('text-blue-700 dark:text-blue-400');
        expect(getColorByThreshold(3.0, config)).toBe('text-blue-700 dark:text-blue-400');
      });

      it('should return green for cashSdebt >= max', () => {
        const config: ThresholdColorConfig = {
          industry: 'Test Industry',
          thresholdData: mockThresholdData,
          minKey: 'cashSdebtMin',
          maxKey: 'cashSdebtMax',
          comparisonMode: 'normal',
        };

        expect(getColorByThreshold(1.2, config)).toBe('text-green-600 dark:text-green-400');
        expect(getColorByThreshold(2.0, config)).toBe('text-green-600 dark:text-green-400');
      });

      it('should return red for cashSdebt <= min', () => {
        const config: ThresholdColorConfig = {
          industry: 'Test Industry',
          thresholdData: mockThresholdData,
          minKey: 'cashSdebtMin',
          maxKey: 'cashSdebtMax',
          comparisonMode: 'normal',
        };

        expect(getColorByThreshold(0.7, config)).toBe('text-red-700 dark:text-red-500');
        expect(getColorByThreshold(0.5, config)).toBe('text-red-700 dark:text-red-500');
      });

      it('should return blue for cashSdebt between min and max', () => {
        const config: ThresholdColorConfig = {
          industry: 'Test Industry',
          thresholdData: mockThresholdData,
          minKey: 'cashSdebtMin',
          maxKey: 'cashSdebtMax',
          comparisonMode: 'normal',
        };

        expect(getColorByThreshold(0.9, config)).toBe('text-blue-700 dark:text-blue-400');
        expect(getColorByThreshold(1.0, config)).toBe('text-blue-700 dark:text-blue-400');
      });
    });

    describe('Inverted mode - leverageF2', () => {
      it('should return green for leverageF2 <= min (inverted)', () => {
        const config: ThresholdColorConfig = {
          industry: 'Test Industry',
          thresholdData: mockThresholdData,
          minKey: 'leverageF2Min',
          maxKey: 'leverageF2Max',
          comparisonMode: 'inverted',
        };

        expect(getColorByThreshold(2.0, config)).toBe('text-green-600 dark:text-green-400');
        expect(getColorByThreshold(1.5, config)).toBe('text-green-600 dark:text-green-400');
      });

      it('should return blue for leverageF2 <= max (inverted)', () => {
        const config: ThresholdColorConfig = {
          industry: 'Test Industry',
          thresholdData: mockThresholdData,
          minKey: 'leverageF2Min',
          maxKey: 'leverageF2Max',
          comparisonMode: 'inverted',
        };

        expect(getColorByThreshold(3.0, config)).toBe('text-blue-700 dark:text-blue-400');
        expect(getColorByThreshold(2.5, config)).toBe('text-blue-700 dark:text-blue-400');
      });

      it('should return red for leverageF2 > max (inverted)', () => {
        const config: ThresholdColorConfig = {
          industry: 'Test Industry',
          thresholdData: mockThresholdData,
          minKey: 'leverageF2Min',
          maxKey: 'leverageF2Max',
          comparisonMode: 'inverted',
        };

        expect(getColorByThreshold(3.5, config)).toBe('text-red-700 dark:text-red-500');
        expect(getColorByThreshold(4.0, config)).toBe('text-red-700 dark:text-red-500');
      });
    });

    describe('Single threshold - IRR', () => {
      it('should return green for IRR >= threshold', () => {
        const config: ThresholdColorConfig = {
          industry: 'Test Industry',
          thresholdData: mockThresholdData,
          thresholdKey: 'irr',
        };

        expect(getColorByThreshold(25, config)).toBe('text-green-600 dark:text-green-400');
        expect(getColorByThreshold(30, config)).toBe('text-green-600 dark:text-green-400');
      });

      it('should return red for IRR < threshold', () => {
        const config: ThresholdColorConfig = {
          industry: 'Test Industry',
          thresholdData: mockThresholdData,
          thresholdKey: 'irr',
        };

        expect(getColorByThreshold(20, config)).toBe('text-red-700 dark:text-red-500');
        expect(getColorByThreshold(24, config)).toBe('text-red-700 dark:text-red-500');
      });
    });

    describe('Value transformation - ro40', () => {
      it('should transform percentage to decimal for ro40', () => {
        const config: ThresholdColorConfig = {
          industry: 'Test Industry',
          thresholdData: mockThresholdData,
          minKey: 'ro40Min',
          maxKey: 'ro40Max',
          comparisonMode: 'normal',
          transform: (v) => v / 100,
        };

        // 30% = 0.30, which is >= 0.25 max, so green
        expect(getColorByThreshold(30, config)).toBe('text-green-600 dark:text-green-400');
        // 10% = 0.10, which is <= 0.15 min, so red
        expect(getColorByThreshold(10, config)).toBe('text-red-700 dark:text-red-500');
        // 20% = 0.20, which is between 0.15 and 0.25, so blue
        expect(getColorByThreshold(20, config)).toBe('text-blue-700 dark:text-blue-400');
      });
    });

    describe('Special cases', () => {
      it('should return green for isDivZero special case', () => {
        const config: ThresholdColorConfig = {
          industry: 'Test Industry',
          thresholdData: mockThresholdData,
          minKey: 'cashSdebtMin',
          maxKey: 'cashSdebtMax',
          comparisonMode: 'normal',
          specialCase: {
            condition: true,
            color: 'text-green-600 dark:text-green-400',
          },
        };

        expect(getColorByThreshold(null, config)).toBe('text-green-600 dark:text-green-400');
      });

      it('should ignore special case when condition is false', () => {
        const config: ThresholdColorConfig = {
          industry: 'Test Industry',
          thresholdData: mockThresholdData,
          minKey: 'cashSdebtMin',
          maxKey: 'cashSdebtMax',
          comparisonMode: 'normal',
          specialCase: {
            condition: false,
            color: 'text-green-600 dark:text-green-400',
          },
        };

        // Should use normal logic, not special case
        expect(getColorByThreshold(1.5, config)).toBe('text-green-600 dark:text-green-400');
      });
    });

    describe('Edge cases', () => {
      it('should return null for null value', () => {
        const config: ThresholdColorConfig = {
          industry: 'Test Industry',
          thresholdData: mockThresholdData,
          minKey: 'currentRatioMin',
          maxKey: 'currentRatioMax',
          comparisonMode: 'normal',
        };

        expect(getColorByThreshold(null, config)).toBeNull();
      });

      it('should return null for non-finite value', () => {
        const config: ThresholdColorConfig = {
          industry: 'Test Industry',
          thresholdData: mockThresholdData,
          minKey: 'currentRatioMin',
          maxKey: 'currentRatioMax',
          comparisonMode: 'normal',
        };

        expect(getColorByThreshold(NaN, config)).toBeNull();
        expect(getColorByThreshold(Infinity, config)).toBeNull();
      });

      it('should return null for empty industry', () => {
        const config: ThresholdColorConfig = {
          industry: '',
          thresholdData: mockThresholdData,
          minKey: 'currentRatioMin',
          maxKey: 'currentRatioMax',
          comparisonMode: 'normal',
        };

        expect(getColorByThreshold(1.5, config)).toBeNull();
      });

      it('should return null for missing industry in threshold data', () => {
        const config: ThresholdColorConfig = {
          industry: 'Unknown Industry',
          thresholdData: mockThresholdData,
          minKey: 'currentRatioMin',
          maxKey: 'currentRatioMax',
          comparisonMode: 'normal',
        };

        expect(getColorByThreshold(1.5, config)).toBeNull();
      });

      it('should return null when thresholdData is empty', () => {
        const config: ThresholdColorConfig = {
          industry: 'Test Industry',
          thresholdData: [],
          minKey: 'currentRatioMin',
          maxKey: 'currentRatioMax',
          comparisonMode: 'normal',
        };

        expect(getColorByThreshold(1.5, config)).toBeNull();
      });
    });
  });

  describe('getCurrentRatioColor', () => {
    it('should return green for value >= min && < max', () => {
      expect(getCurrentRatioColor(1.5, 'Test Industry', mockThresholdData)).toBe(
        'text-green-600 dark:text-green-400'
      );
    });

    it('should return red for value < min', () => {
      expect(getCurrentRatioColor(0.8, 'Test Industry', mockThresholdData)).toBe(
        'text-red-700 dark:text-red-500'
      );
    });

    it('should return blue for value >= max', () => {
      expect(getCurrentRatioColor(2.5, 'Test Industry', mockThresholdData)).toBe(
        'text-blue-700 dark:text-blue-400'
      );
    });

    it('should return null for null value', () => {
      expect(getCurrentRatioColor(null, 'Test Industry', mockThresholdData)).toBeNull();
    });
  });

  describe('getCashSdebtColor', () => {
    it('should return green for isDivZero = true', () => {
      expect(getCashSdebtColor(null, true, 'Test Industry', mockThresholdData)).toBe(
        'text-green-600 dark:text-green-400'
      );
    });

    it('should return green for value >= max', () => {
      expect(getCashSdebtColor(1.5, false, 'Test Industry', mockThresholdData)).toBe(
        'text-green-600 dark:text-green-400'
      );
    });

    it('should return red for value <= min', () => {
      expect(getCashSdebtColor(0.5, false, 'Test Industry', mockThresholdData)).toBe(
        'text-red-700 dark:text-red-500'
      );
    });

    it('should return blue for value between min and max', () => {
      expect(getCashSdebtColor(0.9, false, 'Test Industry', mockThresholdData)).toBe(
        'text-blue-700 dark:text-blue-400'
      );
    });

    it('should return null for null value when isDivZero is false', () => {
      expect(getCashSdebtColor(null, false, 'Test Industry', mockThresholdData)).toBeNull();
    });
  });

  describe('getRo40Color', () => {
    it('should transform percentage to decimal and return green for >= max', () => {
      // 30% = 0.30 >= 0.25 max
      expect(getRo40Color(30, 'Test Industry', mockThresholdData)).toBe('text-green-600 dark:text-green-400');
    });

    it('should transform percentage to decimal and return red for <= min', () => {
      // 10% = 0.10 <= 0.15 min
      expect(getRo40Color(10, 'Test Industry', mockThresholdData)).toBe('text-red-700 dark:text-red-500');
    });

    it('should transform percentage to decimal and return blue for between min and max', () => {
      // 20% = 0.20, between 0.15 and 0.25
      expect(getRo40Color(20, 'Test Industry', mockThresholdData)).toBe('text-blue-700 dark:text-blue-400');
    });

    it('should return null for null value', () => {
      expect(getRo40Color(null, 'Test Industry', mockThresholdData)).toBeNull();
    });
  });

  describe('getIRRColor', () => {
    it('should return green for value >= threshold', () => {
      expect(getIRRColor(30, 'Test Industry', mockThresholdData)).toBe('text-green-600 dark:text-green-400');
      expect(getIRRColor(25, 'Test Industry', mockThresholdData)).toBe('text-green-600 dark:text-green-400');
    });

    it('should return red for value < threshold', () => {
      expect(getIRRColor(20, 'Test Industry', mockThresholdData)).toBe('text-red-700 dark:text-red-500');
    });

    it('should return null for null value', () => {
      expect(getIRRColor(null, 'Test Industry', mockThresholdData)).toBeNull();
    });
  });

  describe('getLeverageF2Color', () => {
    it('should return green for value <= min (inverted)', () => {
      expect(getLeverageF2Color(2.0, 'Test Industry', mockThresholdData)).toBe(
        'text-green-600 dark:text-green-400'
      );
      expect(getLeverageF2Color(1.5, 'Test Industry', mockThresholdData)).toBe(
        'text-green-600 dark:text-green-400'
      );
    });

    it('should return blue for value <= max (inverted)', () => {
      expect(getLeverageF2Color(3.0, 'Test Industry', mockThresholdData)).toBe(
        'text-blue-700 dark:text-blue-400'
      );
      expect(getLeverageF2Color(2.5, 'Test Industry', mockThresholdData)).toBe(
        'text-blue-700 dark:text-blue-400'
      );
    });

    it('should return red for value > max (inverted)', () => {
      expect(getLeverageF2Color(3.5, 'Test Industry', mockThresholdData)).toBe('text-red-700 dark:text-red-500');
    });

    it('should return null for null value', () => {
      expect(getLeverageF2Color(null, 'Test Industry', mockThresholdData)).toBeNull();
    });
  });

  describe('getTBSPPriceColor', () => {
    it('should return green for value >= 1.00', () => {
      expect(getTBSPPriceColor(1.0)).toBe('text-green-600 dark:text-green-400');
      expect(getTBSPPriceColor(1.5)).toBe('text-green-600 dark:text-green-400');
    });

    it('should return red for value < 1.00', () => {
      expect(getTBSPPriceColor(0.9)).toBe('text-red-700 dark:text-red-500');
      expect(getTBSPPriceColor(0.5)).toBe('text-red-700 dark:text-red-500');
    });

    it('should return null for null value', () => {
      expect(getTBSPPriceColor(null)).toBeNull();
    });
  });

  describe('getSMAColor', () => {
    it('should return green when price > smaValue', () => {
      expect(getSMAColor(100, 90)).toBe('text-green-600 dark:text-green-400');
    });

    it('should return red when price < smaValue', () => {
      expect(getSMAColor(80, 90)).toBe('text-red-700 dark:text-red-500');
    });

    it('should return yellow when price === smaValue', () => {
      expect(getSMAColor(100, 100)).toBe('text-yellow-600 dark:text-yellow-400');
    });

    it('should return null when price is null', () => {
      expect(getSMAColor(null, 90)).toBeNull();
    });

    it('should return null when smaValue is null', () => {
      expect(getSMAColor(100, null)).toBeNull();
    });

    it('should return null when both are null', () => {
      expect(getSMAColor(null, null)).toBeNull();
    });

    it('should return null when price is undefined', () => {
      expect(getSMAColor(undefined, 90)).toBeNull();
    });
  });
});

