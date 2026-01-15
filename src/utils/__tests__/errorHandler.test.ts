import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatError,
  logError,
  createErrorHandler,
  isErrorType,
  isNetworkError,
  isQuotaError,
  FormattedError,
} from '../errorHandler';

// Mock logger
const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

vi.mock('../logger', () => ({
  logger: mockLogger,
}));

describe('errorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('formatError', () => {
    it('should format Error object', () => {
      const error = new Error('Test error');
      const result = formatError(error);

      expect(result.message).toBe('Test error');
      expect(result.userMessage).toBe('Test error');
      expect(result.originalError).toBe(error);
    });

    it('should format string error', () => {
      const error = 'String error';
      const result = formatError(error);

      expect(result.message).toBe('String error');
      expect(result.userMessage).toBe('String error');
    });

    it('should format error with context', () => {
      const error = new Error('Test error');
      const context = { component: 'test', operation: 'testOperation' };
      const result = formatError(error, context);

      expect(result.context).toEqual(context);
    });

    it('should format CORS error with user-friendly message', () => {
      const error = new Error('CORS error');
      const result = formatError(error);

      expect(result.userMessage).toContain('Connection error');
    });

    it('should format timeout error with user-friendly message', () => {
      const error = new Error('Request timeout');
      const result = formatError(error);

      expect(result.userMessage).toContain('timeout');
    });

    it('should format 404 error with user-friendly message', () => {
      const error = new Error('404 not found');
      const result = formatError(error);

      expect(result.userMessage).toContain('not found');
    });

    it('should format quota error with user-friendly message', () => {
      const error = new Error('QuotaExceededError');
      const result = formatError(error);

      expect(result.userMessage).toContain('Storage limit');
    });

    it('should format network error with user-friendly message', () => {
      const error = new Error('NetworkError');
      const result = formatError(error);

      expect(result.userMessage).toContain('Network error');
    });

    it('should format Firebase error with user-friendly message', () => {
      const error = new Error('Firebase error');
      const result = formatError(error);

      expect(result.userMessage).toContain('Configuration error');
    });

    it('should handle unknown error type', () => {
      const error = { someProperty: 'value' };
      const result = formatError(error);

      expect(result.message).toBeTruthy();
    });

    it('should include operation in user message when provided', () => {
      const error = new Error('Test error');
      const context = { operation: 'fetch data' };
      const result = formatError(error, context);

      expect(result.userMessage).toContain('fetch data');
    });
  });

  describe('logError', () => {
    it('should log error with logger', () => {
      const error = new Error('Test error');
      const context = { component: 'test', operation: 'testOperation' };

      logError(error, context);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Test error',
        error,
        expect.objectContaining({
          component: 'test',
          operation: 'testOperation',
        })
      );
    });

    it('should handle string error', () => {
      logError('String error');

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle unknown error type', () => {
      logError({ someProperty: 'value' });

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('createErrorHandler', () => {
    it('should create error handler function', () => {
      const context = { component: 'test', operation: 'testOperation' };
      const handler = createErrorHandler(context);

      expect(typeof handler).toBe('function');
    });

    it('should handle errors with created handler', () => {
      const context = { component: 'test', operation: 'testOperation' };
      const handler = createErrorHandler(context);
      const error = new Error('Test error');

      const result = handler(error);

      expect(result.message).toBe('Test error');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('isErrorType', () => {
    it('should detect error by name', () => {
      const error = new Error('Test error');
      error.name = 'CustomError';

      expect(isErrorType(error, 'CustomError')).toBe(true);
    });

    it('should detect error by message', () => {
      const error = new Error('NetworkError occurred');

      expect(isErrorType(error, 'NetworkError')).toBe(true);
    });

    it('should detect error in string', () => {
      expect(isErrorType('NetworkError occurred', 'NetworkError')).toBe(true);
    });

    it('should return false for non-matching error', () => {
      const error = new Error('Test error');

      expect(isErrorType(error, 'NetworkError')).toBe(false);
    });
  });

  describe('isNetworkError', () => {
    it('should detect NetworkError', () => {
      const error = new Error('NetworkError');
      expect(isNetworkError(error)).toBe(true);
    });

    it('should detect Failed to fetch', () => {
      const error = new Error('Failed to fetch');
      expect(isNetworkError(error)).toBe(true);
    });

    it('should detect CORS error', () => {
      const error = new Error('CORS error');
      expect(isNetworkError(error)).toBe(true);
    });

    it('should detect timeout error', () => {
      const error = new Error('timeout');
      expect(isNetworkError(error)).toBe(true);
    });

    it('should return false for non-network error', () => {
      const error = new Error('Other error');
      expect(isNetworkError(error)).toBe(false);
    });
  });

  describe('isQuotaError', () => {
    it('should detect QuotaExceededError', () => {
      const error = new Error('QuotaExceededError');
      expect(isQuotaError(error)).toBe(true);
    });

    it('should detect quota error in message', () => {
      const error = new Error('quota exceeded');
      expect(isQuotaError(error)).toBe(true);
    });

    it('should return false for non-quota error', () => {
      const error = new Error('Other error');
      expect(isQuotaError(error)).toBe(false);
    });
  });
});
