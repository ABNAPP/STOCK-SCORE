import { describe, it, expect } from 'vitest';
import {
  isRR1Green,
  isEntry1Green,
  isRR2GreenForTheoEntry,
  isEntry2Green,
  isTheoEntryGreen,
} from '../theoEntryLogic';
import { createMockEntryExitValues } from '../../../test/helpers';

describe('colorThresholds theoEntryLogic', () => {
  describe('isRR1Green', () => {
    it('returns true when RR1 >= 60%, price <= entry1*1.05', () => {
      const values = createMockEntryExitValues({ entry1: 100, exit1: 160 }); // RR1 = 60%
      expect(isRR1Green(values, 100)).toBe(true); // price 100 <= 105
    });
    it('returns false when RR1 < 60%', () => {
      const values = createMockEntryExitValues({ entry1: 100, exit1: 150 }); // RR1 = 50%
      expect(isRR1Green(values, 100)).toBe(false);
    });
    it('returns false when price > entry1*1.05', () => {
      const values = createMockEntryExitValues({ entry1: 100, exit1: 160 });
      expect(isRR1Green(values, 110)).toBe(false); // 110 > 105
    });
    it('returns false for undefined entryExitValues', () => {
      expect(isRR1Green(undefined, 100)).toBe(false);
    });
  });

  describe('isEntry1Green', () => {
    it('returns true when price <= entry1*1.05', () => {
      const values = createMockEntryExitValues({ entry1: 100 });
      expect(isEntry1Green(values, 100)).toBe(true);
    });
    it('returns false when price > entry1*1.05', () => {
      const values = createMockEntryExitValues({ entry1: 100 });
      expect(isEntry1Green(values, 110)).toBe(false);
    });
  });

  describe('isRR2GreenForTheoEntry', () => {
    it('returns true when RR2 > 60%, price <= entry2*1.05', () => {
      const values = createMockEntryExitValues({ entry2: 90, exit2: 150 }); // RR2 > 60%
      expect(isRR2GreenForTheoEntry(values, 90)).toBe(true);
    });
  });

  describe('isEntry2Green', () => {
    it('returns true when price <= entry2*1.05', () => {
      const values = createMockEntryExitValues({ entry2: 90 });
      expect(isEntry2Green(values, 90)).toBe(true);
    });
  });

  describe('isTheoEntryGreen', () => {
    it('returns true when RR1 path is green', () => {
      const values = createMockEntryExitValues({ entry1: 100, exit1: 160 });
      expect(isTheoEntryGreen(values, 100)).toBe(true);
    });
  });
});
