import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchJSONData, fetchCSVData, convert2DArrayToObjects, validateCSVText } from '../sheets/fetchService';

// Mock environment variables
const originalEnv = import.meta.env;

describe('fetchService Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset fetch mock
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchJSONData error cases', () => {
    it('should handle CORS errors', async () => {
      const mockTransformer = vi.fn((results) => results.data);
      
      global.fetch = vi.fn().mockRejectedValue(
        new TypeError('Failed to fetch')
      );

      await expect(
        fetchJSONData(
          'TestSheet',
          'Test Data',
          mockTransformer,
          undefined,
          undefined,
          true
        )
      ).rejects.toThrow(/CORS|Connection error/);
    });

    it('should handle 404 errors', async () => {
      const mockTransformer = vi.fn((results) => results.data);
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      await expect(
        fetchJSONData(
          'TestSheet',
          'Test Data',
          mockTransformer,
          undefined,
          undefined,
          true
        )
      ).rejects.toThrow(/404|not found/);
    });

    it('should handle 401/403 errors', async () => {
      const mockTransformer = vi.fn((results) => results.data);
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      } as Response);

      await expect(
        fetchJSONData(
          'TestSheet',
          'Test Data',
          mockTransformer,
          undefined,
          undefined,
          true
        )
      ).rejects.toThrow(/403|access denied/);
    });

    it('should handle invalid JSON response', async () => {
      const mockTransformer = vi.fn((results) => results.data);
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
      } as unknown as Response);

      await expect(
        fetchJSONData(
          'TestSheet',
          'Test Data',
          mockTransformer,
          undefined,
          undefined,
          true
        )
      ).rejects.toThrow(/parse JSON|Invalid JSON/);
    });

    it('should handle empty array response', async () => {
      const mockTransformer = vi.fn((results) => results.data);
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      } as unknown as Response);

      await expect(
        fetchJSONData(
          'TestSheet',
          'Test Data',
          mockTransformer,
          undefined,
          undefined,
          true
        )
      ).rejects.toThrow(/Invalid JSON response|expected non-empty array/);
    });

    it('should handle network timeout', async () => {
      const mockTransformer = vi.fn((results) => results.data);
      
      global.fetch = vi.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 100);
        });
      });

      await expect(
        fetchJSONData(
          'TestSheet',
          'Test Data',
          mockTransformer,
          undefined,
          undefined,
          true
        )
      ).rejects.toThrow();
    });
  });

  describe('fetchCSVData error cases', () => {
    it('should handle all proxy failures', async () => {
      const mockTransformer = vi.fn((results) => results.data);
      
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(
        fetchCSVData(
          'https://example.com/sheet.csv',
          'Test Data',
          mockTransformer,
          undefined,
          undefined,
          true
        )
      ).rejects.toThrow(/Failed to fetch.*all proxies/);
    });

    it('should handle timeout errors', async () => {
      const mockTransformer = vi.fn((results) => results.data);
      
      const controller = new AbortController();
      controller.abort();
      
      global.fetch = vi.fn().mockRejectedValue(
        new Error('AbortError')
      );

      await expect(
        fetchCSVData(
          'https://example.com/sheet.csv',
          'Test Data',
          mockTransformer,
          undefined,
          undefined,
          true
        )
      ).rejects.toThrow();
    });

    it('should handle HTML response instead of CSV', async () => {
      const mockTransformer = vi.fn((results) => results.data);
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('<!DOCTYPE html><html>...</html>'),
      } as unknown as Response);

      await expect(
        fetchCSVData(
          'https://example.com/sheet.csv',
          'Test Data',
          mockTransformer,
          undefined,
          undefined,
          true
        )
      ).rejects.toThrow(/HTML login page|not publicly accessible/);
    });

    it('should handle empty CSV response', async () => {
      const mockTransformer = vi.fn((results) => results.data);
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(''),
      } as unknown as Response);

      await expect(
        fetchCSVData(
          'https://example.com/sheet.csv',
          'Test Data',
          mockTransformer,
          undefined,
          undefined,
          true
        )
      ).rejects.toThrow(/Empty response/);
    });
  });

  describe('convert2DArrayToObjects edge cases', () => {
    it('should handle empty array', () => {
      const result = convert2DArrayToObjects([]);
      expect(result).toEqual([]);
    });

    it('should handle array with only headers', () => {
      const result = convert2DArrayToObjects([['Header1', 'Header2']]);
      expect(result).toEqual([]);
    });

    it('should handle null/undefined values', () => {
      const result = convert2DArrayToObjects([
        ['Header1', 'Header2'],
        [null, undefined],
        ['Value1', 'Value2'],
      ]);
      expect(result).toEqual([
        { Header1: '', Header2: '' },
        { Header1: 'Value1', Header2: 'Value2' },
      ]);
    });
  });

  describe('validateCSVText edge cases', () => {
    it('should throw on empty string', () => {
      expect(() => validateCSVText('')).toThrow(/Empty response/);
    });

    it('should throw on HTML content', () => {
      expect(() => validateCSVText('<!DOCTYPE html><html></html>')).toThrow(/HTML/);
    });

    it('should throw on Google sign-in page', () => {
      expect(() => validateCSVText('Sign in to your Google Account')).toThrow(/HTML login page/);
    });

    it('should throw on invalid CSV format', () => {
      const longInvalidText = 'a'.repeat(200);
      expect(() => validateCSVText(longInvalidText)).toThrow(/valid CSV/);
    });
  });
});
