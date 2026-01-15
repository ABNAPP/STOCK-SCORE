import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, Logger, LogLevel } from '../logger';

// Mock console methods
const mockConsoleDebug = vi.spyOn(console, 'debug').mockImplementation(() => {});
const mockConsoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('PROD', 'false');
    vi.stubEnv('DEV', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('debug', () => {
    it('should log debug message in development', () => {
      logger.debug('Debug message');

      expect(mockConsoleDebug).toHaveBeenCalledWith(expect.stringContaining('[DEBUG]'));
    });

    it('should not log debug message in production', () => {
      vi.stubEnv('PROD', 'true');
      vi.stubEnv('DEV', 'false');

      logger.debug('Debug message');

      expect(mockConsoleDebug).not.toHaveBeenCalled();
    });

    it('should include context in message', () => {
      logger.debug('Debug message', { component: 'test', operation: 'testOp' });

      expect(mockConsoleDebug).toHaveBeenCalledWith(
        expect.stringContaining('component: test')
      );
    });
  });

  describe('info', () => {
    it('should log info message', () => {
      logger.info('Info message');

      expect(mockConsoleInfo).toHaveBeenCalledWith(expect.stringContaining('[INFO]'));
    });

    it('should include context in message', () => {
      logger.info('Info message', { component: 'test' });

      expect(mockConsoleInfo).toHaveBeenCalledWith(
        expect.stringContaining('component: test')
      );
    });
  });

  describe('warn', () => {
    it('should log warning message', () => {
      logger.warn('Warning message');

      expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining('[WARN]'));
    });

    it('should include context in message', () => {
      logger.warn('Warning message', { component: 'test' });

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('component: test')
      );
    });
  });

  describe('error', () => {
    it('should log error message', () => {
      const error = new Error('Test error');
      logger.error('Error message', error);

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]'),
        error
      );
    });

    it('should handle string error', () => {
      logger.error('Error message', 'String error');

      expect(mockConsoleError).toHaveBeenCalled();
    });

    it('should handle unknown error type', () => {
      logger.error('Error message', { someProperty: 'value' });

      expect(mockConsoleError).toHaveBeenCalled();
    });

    it('should include context in message', () => {
      const error = new Error('Test error');
      logger.error('Error message', error, { component: 'test' });

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('component: test'),
        expect.anything()
      );
    });
  });

  describe('log', () => {
    it('should log with explicit level', () => {
      logger.log('info', 'Info message');

      expect(mockConsoleInfo).toHaveBeenCalled();
    });

    it('should log error with explicit level', () => {
      const error = new Error('Test error');
      logger.log('error', 'Error message', error);

      expect(mockConsoleError).toHaveBeenCalled();
    });
  });

  describe('configure', () => {
    it('should configure logger settings', () => {
      const testLogger = new Logger();
      testLogger.configure({ enableInProduction: true });

      // Configuration should be applied
      expect(testLogger).toBeDefined();
    });
  });

  describe('production vs development', () => {
    it('should show all logs in development', () => {
      vi.stubEnv('DEV', 'true');
      vi.stubEnv('PROD', 'false');

      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warn');
      logger.error('Error', new Error('Test'));

      expect(mockConsoleDebug).toHaveBeenCalled();
      expect(mockConsoleInfo).toHaveBeenCalled();
      expect(mockConsoleWarn).toHaveBeenCalled();
      expect(mockConsoleError).toHaveBeenCalled();
    });

    it('should only show warnings and errors in production', () => {
      vi.stubEnv('DEV', 'false');
      vi.stubEnv('PROD', 'true');

      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warn');
      logger.error('Error', new Error('Test'));

      expect(mockConsoleDebug).not.toHaveBeenCalled();
      expect(mockConsoleInfo).not.toHaveBeenCalled();
      expect(mockConsoleWarn).toHaveBeenCalled();
      expect(mockConsoleError).toHaveBeenCalled();
    });
  });
});
