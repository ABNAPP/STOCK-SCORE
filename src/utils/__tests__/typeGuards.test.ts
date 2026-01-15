import { describe, it, expect } from 'vitest';
import {
  isObject,
  isArray,
  isString,
  isNumber,
  isBoolean,
  isNullOrUndefined,
  isValidNumber,
  isNonEmptyString,
  hasKey,
  hasKeys,
  isDataRow,
  isDataRowArray,
  is2DArray,
  isValidTimestamp,
  isValidUrl,
  isValidEmail,
  isValidJsonString,
  isMap,
  isSet,
  isFunction,
  isPromise,
  isValidDate,
  isPositiveInteger,
  isNonNegativeInteger,
  isInRange,
  isBenjaminGrahamData,
  isCurrencyString,
  isCacheEntry,
  isDeltaCacheEntry,
} from '../typeGuards';

describe('typeGuards', () => {
  describe('isObject', () => {
    it('should return true for objects', () => {
      expect(isObject({})).toBe(true);
      expect(isObject({ key: 'value' })).toBe(true);
    });

    it('should return false for null', () => {
      expect(isObject(null)).toBe(false);
    });

    it('should return false for arrays', () => {
      expect(isObject([])).toBe(false);
    });

    it('should return false for primitives', () => {
      expect(isObject('string')).toBe(false);
      expect(isObject(123)).toBe(false);
      expect(isObject(true)).toBe(false);
    });
  });

  describe('isArray', () => {
    it('should return true for arrays', () => {
      expect(isArray([])).toBe(true);
      expect(isArray([1, 2, 3])).toBe(true);
    });

    it('should return false for non-arrays', () => {
      expect(isArray({})).toBe(false);
      expect(isArray('string')).toBe(false);
    });
  });

  describe('isString', () => {
    it('should return true for strings', () => {
      expect(isString('test')).toBe(true);
      expect(isString('')).toBe(true);
    });

    it('should return false for non-strings', () => {
      expect(isString(123)).toBe(false);
      expect(isString(null)).toBe(false);
    });
  });

  describe('isNumber', () => {
    it('should return true for valid numbers', () => {
      expect(isNumber(123)).toBe(true);
      expect(isNumber(0)).toBe(true);
      expect(isNumber(-123)).toBe(true);
      expect(isNumber(123.45)).toBe(true);
    });

    it('should return false for NaN', () => {
      expect(isNumber(NaN)).toBe(false);
    });

    it('should return false for Infinity', () => {
      expect(isNumber(Infinity)).toBe(false);
      expect(isNumber(-Infinity)).toBe(false);
    });

    it('should return false for non-numbers', () => {
      expect(isNumber('123')).toBe(false);
      expect(isNumber(null)).toBe(false);
    });
  });

  describe('isBoolean', () => {
    it('should return true for booleans', () => {
      expect(isBoolean(true)).toBe(true);
      expect(isBoolean(false)).toBe(true);
    });

    it('should return false for non-booleans', () => {
      expect(isBoolean(1)).toBe(false);
      expect(isBoolean('true')).toBe(false);
    });
  });

  describe('isNullOrUndefined', () => {
    it('should return true for null', () => {
      expect(isNullOrUndefined(null)).toBe(true);
    });

    it('should return true for undefined', () => {
      expect(isNullOrUndefined(undefined)).toBe(true);
    });

    it('should return false for other values', () => {
      expect(isNullOrUndefined(0)).toBe(false);
      expect(isNullOrUndefined('')).toBe(false);
    });
  });

  describe('isValidNumber', () => {
    it('should return true for valid numbers', () => {
      expect(isValidNumber(123)).toBe(true);
      expect(isValidNumber(0)).toBe(true);
    });

    it('should return false for NaN', () => {
      expect(isValidNumber(NaN)).toBe(false);
    });
  });

  describe('isNonEmptyString', () => {
    it('should return true for non-empty strings', () => {
      expect(isNonEmptyString('test')).toBe(true);
    });

    it('should return false for empty strings', () => {
      expect(isNonEmptyString('')).toBe(false);
      expect(isNonEmptyString('   ')).toBe(false);
    });
  });

  describe('hasKey', () => {
    it('should return true if object has key', () => {
      expect(hasKey({ test: 'value' }, 'test')).toBe(true);
    });

    it('should return false if object does not have key', () => {
      expect(hasKey({ test: 'value' }, 'other')).toBe(false);
    });
  });

  describe('hasKeys', () => {
    it('should return true if object has all keys', () => {
      expect(hasKeys({ a: 1, b: 2, c: 3 }, ['a', 'b'])).toBe(true);
    });

    it('should return false if object missing any key', () => {
      expect(hasKeys({ a: 1 }, ['a', 'b'])).toBe(false);
    });
  });

  describe('isDataRow', () => {
    it('should return true for valid DataRow', () => {
      expect(isDataRow({ key: 'value', num: 123 })).toBe(true);
    });

    it('should return false for invalid DataRow', () => {
      expect(isDataRow({ key: {} })).toBe(false);
      expect(isDataRow(null)).toBe(false);
    });
  });

  describe('isDataRowArray', () => {
    it('should return true for array of DataRow', () => {
      expect(isDataRowArray([{ key: 'value' }, { key: 'value2' }])).toBe(true);
    });

    it('should return false for non-array', () => {
      expect(isDataRowArray({})).toBe(false);
    });
  });

  describe('is2DArray', () => {
    it('should return true for 2D array', () => {
      expect(is2DArray([[1, 2], [3, 4]])).toBe(true);
    });

    it('should return false for 1D array', () => {
      expect(is2DArray([1, 2, 3])).toBe(false);
    });
  });

  describe('isValidTimestamp', () => {
    it('should return true for Date', () => {
      expect(isValidTimestamp(new Date())).toBe(true);
    });

    it('should return true for valid number timestamp', () => {
      expect(isValidTimestamp(Date.now())).toBe(true);
    });

    it('should return false for invalid timestamp', () => {
      expect(isValidTimestamp(0)).toBe(false);
      expect(isValidTimestamp(-1)).toBe(false);
    });
  });

  describe('isValidUrl', () => {
    it('should return true for valid URL', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://example.com/path')).toBe(true);
    });

    it('should return false for invalid URL', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('')).toBe(false);
    });
  });

  describe('isValidEmail', () => {
    it('should return true for valid email', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
    });

    it('should return false for invalid email', () => {
      expect(isValidEmail('not-an-email')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
    });
  });

  describe('isValidJsonString', () => {
    it('should return true for valid JSON', () => {
      expect(isValidJsonString('{"key":"value"}')).toBe(true);
    });

    it('should return false for invalid JSON', () => {
      expect(isValidJsonString('not json')).toBe(false);
      expect(isValidJsonString('{key:value}')).toBe(false);
    });
  });

  describe('isMap', () => {
    it('should return true for Map', () => {
      expect(isMap(new Map())).toBe(true);
    });

    it('should return false for non-Map', () => {
      expect(isMap({})).toBe(false);
    });
  });

  describe('isSet', () => {
    it('should return true for Set', () => {
      expect(isSet(new Set())).toBe(true);
    });

    it('should return false for non-Set', () => {
      expect(isSet([])).toBe(false);
    });
  });

  describe('isFunction', () => {
    it('should return true for functions', () => {
      expect(isFunction(() => {})).toBe(true);
      expect(isFunction(function() {})).toBe(true);
    });

    it('should return false for non-functions', () => {
      expect(isFunction({})).toBe(false);
    });
  });

  describe('isPromise', () => {
    it('should return true for Promise', () => {
      expect(isPromise(Promise.resolve())).toBe(true);
    });

    it('should return false for non-Promise', () => {
      expect(isPromise({})).toBe(false);
    });
  });

  describe('isValidDate', () => {
    it('should return true for valid Date', () => {
      expect(isValidDate(new Date())).toBe(true);
    });

    it('should return false for invalid Date', () => {
      expect(isValidDate(new Date('invalid'))).toBe(false);
    });
  });

  describe('isPositiveInteger', () => {
    it('should return true for positive integers', () => {
      expect(isPositiveInteger(1)).toBe(true);
      expect(isPositiveInteger(100)).toBe(true);
    });

    it('should return false for zero', () => {
      expect(isPositiveInteger(0)).toBe(false);
    });

    it('should return false for negative numbers', () => {
      expect(isPositiveInteger(-1)).toBe(false);
    });
  });

  describe('isNonNegativeInteger', () => {
    it('should return true for non-negative integers', () => {
      expect(isNonNegativeInteger(0)).toBe(true);
      expect(isNonNegativeInteger(100)).toBe(true);
    });

    it('should return false for negative numbers', () => {
      expect(isNonNegativeInteger(-1)).toBe(false);
    });
  });

  describe('isInRange', () => {
    it('should return true for value in range', () => {
      expect(isInRange(50, 0, 100)).toBe(true);
      expect(isInRange(0, 0, 100)).toBe(true);
      expect(isInRange(100, 0, 100)).toBe(true);
    });

    it('should return false for value outside range', () => {
      expect(isInRange(-1, 0, 100)).toBe(false);
      expect(isInRange(101, 0, 100)).toBe(false);
    });
  });

  describe('isBenjaminGrahamData', () => {
    it('should return true for valid BenjaminGrahamData', () => {
      expect(isBenjaminGrahamData({
        companyName: 'Test',
        ticker: 'TEST',
        price: 100,
        benjaminGraham: 90,
      })).toBe(true);
    });

    it('should return false for invalid data', () => {
      expect(isBenjaminGrahamData({})).toBe(false);
      expect(isBenjaminGrahamData(null)).toBe(false);
    });
  });

  describe('isCurrencyString', () => {
    it('should return true for valid currency', () => {
      expect(isCurrencyString('USD')).toBe(true);
      expect(isCurrencyString('EUR')).toBe(true);
    });

    it('should return false for empty string', () => {
      expect(isCurrencyString('')).toBe(false);
    });

    it('should return false for too long string', () => {
      expect(isCurrencyString('A'.repeat(11))).toBe(false);
    });
  });

  describe('isCacheEntry', () => {
    it('should return true for valid CacheEntry', () => {
      expect(isCacheEntry({
        data: { test: 'value' },
        timestamp: Date.now(),
        ttl: 60000,
      })).toBe(true);
    });

    it('should return false for invalid CacheEntry', () => {
      expect(isCacheEntry({})).toBe(false);
    });
  });

  describe('isDeltaCacheEntry', () => {
    it('should return true for valid DeltaCacheEntry', () => {
      expect(isDeltaCacheEntry({
        data: { test: 'value' },
        version: 1,
      })).toBe(true);
    });

    it('should return false for invalid DeltaCacheEntry', () => {
      expect(isDeltaCacheEntry({})).toBe(false);
    });
  });
});
