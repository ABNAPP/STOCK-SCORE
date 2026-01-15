/**
 * Centralized Logger Utility
 * 
 * Provides a centralized logging system with different log levels (debug, info, warn, error).
 * Supports environment-based filtering and prepares for integration with error tracking services
 * like Sentry or LogRocket in production.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  component?: string;
  operation?: string;
  [key: string]: unknown;
}

interface LoggerConfig {
  level: LogLevel;
  enableInProduction: boolean;
}

// Log levels in order of severity (higher number = more severe)
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Determine current log level based on environment
function getLogLevel(): LogLevel {
  if (import.meta.env.DEV) {
    return 'debug'; // Show all logs in development
  }
  // In production, only show warnings and errors
  return 'warn';
}

// Check if a log level should be output
function shouldLog(level: LogLevel, config: LoggerConfig): boolean {
  if (!config.enableInProduction && import.meta.env.PROD) {
    return false;
  }
  return LOG_LEVELS[level] >= LOG_LEVELS[config.level];
}

// Format log message with context
function formatMessage(message: string, context?: LogContext): string {
  if (!context || Object.keys(context).length === 0) {
    return message;
  }
  
  const contextStr = Object.entries(context)
    .filter(([_, value]) => value !== undefined && value !== null)
    .map(([key, value]) => {
      if (typeof value === 'object') {
        try {
          return `${key}: ${JSON.stringify(value)}`;
        } catch {
          return `${key}: [object]`;
        }
      }
      return `${key}: ${value}`;
    })
    .join(', ');
  
  return contextStr ? `${message} (${contextStr})` : message;
}

// Send error to external tracking service (prepared for future integration)
function sendToTrackingService(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
  // In production, this can be extended to send to Sentry, LogRocket, etc.
  // For now, we just prepare the structure
  if (import.meta.env.PROD && level === 'error') {
    // Future: Send to Sentry/LogRocket
    // Example: Sentry.captureException(error, { extra: context });
  }
}

class Logger {
  private config: LoggerConfig;

  constructor() {
    this.config = {
      level: getLogLevel(),
      enableInProduction: false, // Disable verbose logs in production by default
    };
  }

  /**
   * Configure logger settings
   * 
   * Allows runtime configuration of log levels and production behavior.
   * Useful for enabling debug logs in production for troubleshooting.
   * 
   * @param config - Partial configuration to merge with existing settings
   * 
   * @example
   * ```typescript
   * // Enable debug logs in production for troubleshooting
   * logger.configure({ level: 'debug', enableInProduction: true });
   * 
   * // Set to only show errors
   * logger.configure({ level: 'error' });
   * ```
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Log debug messages (only in development)
   * 
   * Debug logs are only shown in development mode. Use for detailed
   * information useful during development but too verbose for production.
   * 
   * @param message - Debug message
   * @param context - Optional context information
   * 
   * @example
   * ```typescript
   * logger.debug('Cache hit', { component: 'cacheService', key: 'scoreBoard' });
   * logger.debug('Processing row', { rowIndex: 5, totalRows: 100 });
   * ```
   */
  debug(message: string, context?: LogContext): void {
    if (shouldLog('debug', this.config)) {
      console.debug(`[DEBUG] ${formatMessage(message, context)}`);
    }
  }

  /**
   * Log informational messages
   * 
   * Use for important events that should be visible in production logs,
   * such as successful operations, state changes, or significant events.
   * 
   * @param message - Info message
   * @param context - Optional context information
   * 
   * @example
   * ```typescript
   * logger.info('Data loaded successfully', { 
   *   component: 'useScoreBoardData', 
   *   count: 150 
   * });
   * logger.info('User logged in', { userId: user.id });
   * ```
   */
  info(message: string, context?: LogContext): void {
    if (shouldLog('info', this.config)) {
      console.info(`[INFO] ${formatMessage(message, context)}`);
    }
  }

  /**
   * Log warning messages
   * 
   * Use for situations that are not errors but should be noted, such as
   * fallback behavior, deprecated API usage, or non-critical issues.
   * Warnings are sent to tracking services in production.
   * 
   * @param message - Warning message
   * @param context - Optional context information
   * 
   * @example
   * ```typescript
   * logger.warn('Cache expired, fetching fresh data', { 
   *   component: 'cacheService', 
   *   key: 'scoreBoard' 
   * });
   * logger.warn('Using fallback proxy', { proxy: 'corsproxy.io' });
   * ```
   */
  warn(message: string, context?: LogContext): void {
    if (shouldLog('warn', this.config)) {
      console.warn(`[WARN] ${formatMessage(message, context)}`);
    }
    sendToTrackingService('warn', message, context);
  }

  /**
   * Log error messages
   * 
   * Use for actual errors that need attention. Errors are always logged
   * and sent to tracking services in production for monitoring.
   * 
   * @param message - Error message
   * @param error - Optional Error object or error value
   * @param context - Optional context information
   * 
   * @example
   * ```typescript
   * try {
   *   await fetchData();
   * } catch (error) {
   *   logger.error('Failed to fetch data', error, {
   *     component: 'fetchService',
   *     operation: 'fetchJSONData',
   *     url: apiUrl
   *   });
   * }
   * ```
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (shouldLog('error', this.config)) {
      const errorMessage = error instanceof Error ? error.message : String(error || message);
      console.error(`[ERROR] ${formatMessage(message, context)}`, error || '');
    }
    
    // Always send errors to tracking service in production
    const errorObj = error instanceof Error ? error : new Error(message);
    sendToTrackingService('error', message, context, errorObj);
  }

  /**
   * Log with explicit level
   */
  log(level: LogLevel, message: string, error?: Error | unknown, context?: LogContext): void {
    switch (level) {
      case 'debug':
        this.debug(message, context);
        break;
      case 'info':
        this.info(message, context);
        break;
      case 'warn':
        this.warn(message, context);
        break;
      case 'error':
        this.error(message, error, context);
        break;
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export logger class for testing purposes
export { Logger };
