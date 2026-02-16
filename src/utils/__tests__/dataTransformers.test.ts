import { describe, it, expect } from 'vitest';
import {
  getValue,
  isValidValue,
  parseNumericValueNullable,
  parsePercentageValueNullable,
  getValueAllowZero,
  calculateMedian,
} from '../../services/sheets/dataTransformers';
import type { DataRow } from '../../services/sheets/types';

describe('dataTransformers Edge Cases', () => {
  describe('getValue edge cases', () => {
    it('should handle empty row', () => {
      const row: DataRow = {};
      expect(getValue(['Test'], row)).toBe('');
    });

    it('should handle row with null values', () => {
      const row: DataRow = { Test: null as unknown as string };
      expect(getValue(['Test'], row)).toBe('');
    });

    it('should handle row with undefined values', () => {
      const row: DataRow = { Test: undefined as unknown as string };
      expect(getValue(['Test'], row)).toBe('');
    });

    it('should handle case-insensitive matching', () => {
      const row: DataRow = { TEST: 'value', test: 'other' };
      expect(getValue(['Test'], row)).toBe('value');
    });

    it('should handle whitespace in values', () => {
      const row: DataRow = { Test: '  value  ' };
      expect(getValue(['Test'], row)).toBe('value');
    });

    it('should handle special characters in column names', () => {
      const row: DataRow = { 'Test-Column': 'value', 'Test_Column': 'other' };
      expect(getValue(['Test-Column'], row)).toBe('value');
    });
  });

  describe('isValidValue edge cases', () => {
    it('should reject empty string', () => {
      expect(isValidValue('')).toBe(false);
    });

    it('should reject whitespace-only string', () => {
      expect(isValidValue('   ')).toBe(false);
    });

    it('should reject #N/A variations', () => {
      expect(isValidValue('#N/A')).toBe(false);
      expect(isValidValue('N/A')).toBe(false);
      expect(isValidValue('n/a')).toBe(false);
      expect(isValidValue('#n/a')).toBe(false);
    });

    it('should reject Excel error values', () => {
      expect(isValidValue('#NUM!')).toBe(false);
      expect(isValidValue('#VALUE!')).toBe(false);
      expect(isValidValue('#DIV/0!')).toBe(false);
      expect(isValidValue('#REF!')).toBe(false);
    });

    it('should accept valid values', () => {
      expect(isValidValue('Valid Value')).toBe(true);
      expect(isValidValue('123')).toBe(true);
      expect(isValidValue('0')).toBe(true);
    });
  });

  describe('parseNumericValueNullable edge cases', () => {
    it('should handle empty string', () => {
      expect(parseNumericValueNullable('')).toBeNull();
    });

    it('should handle #N/A', () => {
      expect(parseNumericValueNullable('#N/A')).toBeNull();
    });

    it('should handle strings with commas', () => {
      expect(parseNumericValueNullable('1,234.56')).toBe(1234.56);
    });

    it('should handle strings with currency symbols', () => {
      expect(parseNumericValueNullable('$123.45')).toBe(123.45);
    });

    it('should handle strings with percentage signs', () => {
      expect(parseNumericValueNullable('50%')).toBe(50);
    });

    it('should handle strings with spaces', () => {
      expect(parseNumericValueNullable('  123  ')).toBe(123);
    });

    it('should handle zero value', () => {
      expect(parseNumericValueNullable('0')).toBe(0);
    });

    it('should handle negative values', () => {
      expect(parseNumericValueNullable('-123.45')).toBe(-123.45);
    });

    it('should handle very large numbers', () => {
      expect(parseNumericValueNullable('999999999')).toBe(999999999);
    });

    it('should handle very small numbers', () => {
      expect(parseNumericValueNullable('0.000001')).toBe(0.000001);
    });

    it('should handle scientific notation', () => {
      expect(parseNumericValueNullable('1.23e5')).toBe(123000);
    });

    it('should return null for invalid formats', () => {
      expect(parseNumericValueNullable('abc')).toBeNull();
      expect(parseNumericValueNullable('12.34.56')).toBeNull();
    });
  });

  describe('parsePercentageValueNullable edge cases', () => {
    it('should handle percentage strings', () => {
      expect(parsePercentageValueNullable('50%')).toBe(50);
      expect(parsePercentageValueNullable('15.5%')).toBe(15.5);
    });

    it('should handle percentage with spaces', () => {
      expect(parsePercentageValueNullable('  50%  ')).toBe(50);
    });

    it('should handle percentage with commas', () => {
      expect(parsePercentageValueNullable('1,234.56%')).toBe(1234.56);
    });

    it('should return null for invalid percentage', () => {
      expect(parsePercentageValueNullable('abc%')).toBeNull();
    });
  });

  describe('getValueAllowZero edge cases', () => {
    it('should return "0" for zero value', () => {
      const row: DataRow = { Test: 0 };
      expect(getValueAllowZero(['Test'], row)).toBe('0');
    });

    it('should return "0" for string "0"', () => {
      const row: DataRow = { Test: '0' };
      expect(getValueAllowZero(['Test'], row)).toBe('0');
    });

    it('should skip empty strings', () => {
      const row: DataRow = { Test: '' };
      expect(getValueAllowZero(['Test'], row)).toBe('');
    });
  });

  describe('calculateMedian edge cases', () => {
    it('should return null for empty array', () => {
      expect(calculateMedian([])).toBeNull();
    });

    it('should handle single value', () => {
      expect(calculateMedian([5])).toBe(5);
    });

    it('should handle two values', () => {
      expect(calculateMedian([5, 10])).toBe(7.5);
    });

    it('should handle odd number of values', () => {
      expect(calculateMedian([1, 3, 5, 7, 9])).toBe(5);
    });

    it('should handle even number of values', () => {
      expect(calculateMedian([1, 3, 5, 7])).toBe(4);
    });

    it('should handle unsorted array', () => {
      expect(calculateMedian([9, 1, 5, 3, 7])).toBe(5);
    });

    it('should handle negative values', () => {
      expect(calculateMedian([-5, -3, -1, 1, 3, 5])).toBe(0);
    });

    it('should handle duplicate values', () => {
      expect(calculateMedian([5, 5, 5, 5, 5])).toBe(5);
    });

    it('should handle decimal values', () => {
      expect(calculateMedian([1.1, 2.2, 3.3, 4.4, 5.5])).toBe(3.3);
    });
  });

});
