import { describe, it, expect } from 'vitest';
import {
  isRR1Green,
  isEntry1Green,
  isRR2GreenForTheoEntry,
  isEntry2Green,
  isTheoEntryGreen,
  getRR1Value,
  getRR2Value,
} from '../theoEntryLogic';
import type { EntryExitValuesForScore } from '../../../types/score';

function createMockEntryExitValues(partial: Partial<EntryExitValuesForScore> = {}): EntryExitValuesForScore {
  return {
    entry1: 0,
    entry2: 0,
    exit1: 0,
    exit2: 0,
    currency: 'USD',
    dateOfUpdate: null,
    ...partial,
  };
}

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
    it('returns true when exit1 is empty, uses exit2 for RR1 (Exit2-fallback)', () => {
      const values = createMockEntryExitValues({ entry1: 100, exit2: 160 }); // exit1=0, RR1 = (160-100)/100*100 = 60%
      expect(isRR1Green(values, 100)).toBe(true); // price 100 <= 105
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
    it('returns true when exit2 is empty, uses exit1 for RR2 (Exit1-fallback)', () => {
      const values = createMockEntryExitValues({ entry2: 90, exit1: 160 }); // exit2=0, RR2 = (160-90)/90*100 > 60%
      expect(isRR2GreenForTheoEntry(values, 90)).toBe(true); // price 90 <= 94.5
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
    it('returns true when RR2 path is green with exit1 fallback (no exit2)', () => {
      const values = createMockEntryExitValues({ entry2: 90, exit1: 160 }); // exit2 empty, RR2 = (160-90)/90*100 > 60%
      expect(isTheoEntryGreen(values, 90)).toBe(true);
    });
    it('returns true when RR1 path is green with exit2 fallback (no exit1)', () => {
      const values = createMockEntryExitValues({ entry1: 100, exit2: 160 }); // exit1 empty, RR1 = (160-100)/100*100 = 60%
      expect(isTheoEntryGreen(values, 100)).toBe(true);
    });
  });

  describe('getRR1Value', () => {
    it('returns RR1 when exit1 is present', () => {
      const values = createMockEntryExitValues({ entry1: 100, exit1: 170 }); // RR1 = 70%
      expect(getRR1Value(values)).toBe(70);
    });
    it('returns RR1 using exit2 when exit1 is 0 (fallback)', () => {
      const values = createMockEntryExitValues({ entry1: 100, exit2: 160 }); // RR1 = (160-100)/100*100 = 60%
      expect(getRR1Value(values)).toBe(60);
    });
    it('returns null for undefined entryExitValues', () => {
      expect(getRR1Value(undefined)).toBe(null);
    });
  });

  describe('getRR2Value', () => {
    it('returns RR2 when exit2 is present', () => {
      const values = createMockEntryExitValues({ entry2: 100, exit2: 170 }); // RR2 = 70%
      expect(getRR2Value(values)).toBe(70);
    });
    it('returns RR2 using exit1 when exit2 is 0 (fallback)', () => {
      const values = createMockEntryExitValues({ entry2: 100, exit1: 160 }); // RR2 = (160-100)/100*100 = 60%
      expect(getRR2Value(values)).toBe(60);
    });
    it('returns null for undefined entryExitValues', () => {
      expect(getRR2Value(undefined)).toBe(null);
    });
  });
});
