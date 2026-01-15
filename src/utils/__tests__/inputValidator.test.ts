import { describe, it, expect } from 'vitest';
import {
  validateTextInput,
  validateNumberInput,
  validateNumberRange,
  validateSelectInput,
  sanitizeSearchQuery,
  validateEntryExitValue,
  validateFilterName,
  ValidationResult,
} from '../inputValidator';

describe('inputValidator', () => {
  describe('validateTextInput', () => {
    it('should validate text input with default options', () => {
      const result = validateTextInput('test');
      expect(result.isValid).toBe(true);
    });

    it('should validate empty string when allowEmpty is true', () => {
      const result = validateTextInput('');
      expect(result.isValid).toBe(true);
    });

    it('should reject empty string when required is true', () => {
      const result = validateTextInput('', { required: true });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should validate max length', () => {
      const longText = 'a'.repeat(201);
      const result = validateTextInput(longText, { maxLength: 200 });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('200');
    });

    it('should validate min length', () => {
      const result = validateTextInput('ab', { minLength: 5 });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('5');
    });
  });

  describe('validateNumberInput', () => {
    it('should validate valid number', () => {
      const result = validateNumberInput(100);
      expect(result.isValid).toBe(true);
    });

    it('should validate number string', () => {
      const result = validateNumberInput('100');
      expect(result.isValid).toBe(true);
    });

    it('should reject NaN', () => {
      const result = validateNumberInput(NaN);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('valid number');
    });

    it('should validate min value', () => {
      const result = validateNumberInput(50, { min: 100 });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('100');
    });

    it('should validate max value', () => {
      const result = validateNumberInput(150, { max: 100 });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('100');
    });

    it('should validate decimal places', () => {
      const result = validateNumberInput(100.123, { maxDecimals: 2 });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('decimal');
    });

    it('should reject decimals when allowDecimal is false', () => {
      const result = validateNumberInput(100.5, { allowDecimal: false });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('whole number');
    });

    it('should validate required number', () => {
      const result = validateNumberInput(null, { required: true });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('required');
    });
  });

  describe('validateNumberRange', () => {
    it('should validate valid range', () => {
      const result = validateNumberRange({ min: 10, max: 20 });
      expect(result.isValid).toBe(true);
    });

    it('should validate range with only min', () => {
      const result = validateNumberRange({ min: 10 });
      expect(result.isValid).toBe(true);
    });

    it('should validate range with only max', () => {
      const result = validateNumberRange({ max: 20 });
      expect(result.isValid).toBe(true);
    });

    it('should reject range where min > max', () => {
      const result = validateNumberRange({ min: 20, max: 10 });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('less than or equal');
    });

    it('should validate required range', () => {
      const result = validateNumberRange(null, { required: true });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('required');
    });
  });

  describe('validateSelectInput', () => {
    const allowedOptions = ['option1', 'option2', 'option3'];

    it('should validate valid selection', () => {
      const result = validateSelectInput('option1', allowedOptions);
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid selection', () => {
      const result = validateSelectInput('invalid', allowedOptions);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid');
    });

    it('should validate required selection', () => {
      const result = validateSelectInput(null, allowedOptions, { required: true });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('select');
    });
  });

  describe('sanitizeSearchQuery', () => {
    it('should sanitize search query', () => {
      const result = sanitizeSearchQuery('test query');
      expect(result).toBe('test query');
    });

    it('should remove HTML tags', () => {
      const result = sanitizeSearchQuery('test<script>alert("xss")</script>');
      expect(result).not.toContain('<script>');
    });

    it('should escape special characters', () => {
      const result = sanitizeSearchQuery('test & query');
      expect(result).toContain('&amp;');
    });

    it('should limit length', () => {
      const longQuery = 'a'.repeat(300);
      const result = sanitizeSearchQuery(longQuery, 200);
      expect(result.length).toBeLessThanOrEqual(200);
    });

    it('should trim whitespace', () => {
      const result = sanitizeSearchQuery('  test query  ');
      expect(result).toBe('test query');
    });

    it('should escape regex special characters', () => {
      const result = sanitizeSearchQuery('test.*+?^${}()[]\\');
      expect(result).not.toContain('.*+?');
    });

    it('should handle empty string', () => {
      const result = sanitizeSearchQuery('');
      expect(result).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(sanitizeSearchQuery(null as any)).toBe('');
      expect(sanitizeSearchQuery(undefined as any)).toBe('');
    });
  });

  describe('validateEntryExitValue', () => {
    it('should validate entry1 value', () => {
      const result = validateEntryExitValue('entry1', 100);
      expect(result.isValid).toBe(true);
    });

    it('should reject negative entry1 value', () => {
      const result = validateEntryExitValue('entry1', -10);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('0');
    });

    it('should reject entry1 value exceeding max', () => {
      const result = validateEntryExitValue('entry1', 2000000);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('1000000');
    });

    it('should validate entry1 with 2 decimals', () => {
      const result = validateEntryExitValue('entry1', 100.12);
      expect(result.isValid).toBe(true);
    });

    it('should reject entry1 with more than 2 decimals', () => {
      const result = validateEntryExitValue('entry1', 100.123);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('2 decimal');
    });

    it('should validate currency', () => {
      const result = validateEntryExitValue('currency', 'USD');
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid currency', () => {
      const result = validateEntryExitValue('currency', 'INVALID');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid');
    });

    it('should validate dateOfUpdate format', () => {
      const result = validateEntryExitValue('dateOfUpdate', '2024-01-01');
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid dateOfUpdate format', () => {
      const result = validateEntryExitValue('dateOfUpdate', '2024/01/01');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('YYYY-MM-DD');
    });

    it('should reject invalid date', () => {
      const result = validateEntryExitValue('dateOfUpdate', '2024-13-45');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid date');
    });

    it('should allow null dateOfUpdate', () => {
      const result = validateEntryExitValue('dateOfUpdate', null);
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateFilterName', () => {
    it('should validate valid filter name', () => {
      const result = validateFilterName('High Score Stocks');
      expect(result.isValid).toBe(true);
    });

    it('should reject empty filter name', () => {
      const result = validateFilterName('');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should reject filter name exceeding max length', () => {
      const longName = 'a'.repeat(51);
      const result = validateFilterName(longName);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('50');
    });

    it('should reject filter name with dangerous characters', () => {
      const result = validateFilterName('Filter<script>');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('invalid characters');
    });
  });
});
