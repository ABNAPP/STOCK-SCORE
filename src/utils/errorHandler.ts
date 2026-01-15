/**
 * Error Handler Utility
 * 
 * Provides standardized error handling patterns for consistent error formatting,
 * logging, and user-facing error messages throughout the application.
 */

import { logger } from './logger';

export interface ErrorContext {
  operation?: string;
  component?: string;
  additionalInfo?: Record<string, unknown>;
}

export interface FormattedError {
  message: string;
  userMessage: string;
  context: ErrorContext;
  originalError: unknown;
}

/**
 * Extracts a readable error message from various error types
 */
function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message || error.name || 'An error occurred';
  }
  if (typeof error === 'string') {
    return error || 'An error occurred';
  }
  if (error && typeof error === 'object') {
    if ('message' in error && typeof (error as { message: unknown }).message === 'string') {
      return (error as { message: string }).message;
    }
    if ('error' in error && typeof (error as { error: unknown }).error === 'string') {
      return (error as { error: string }).error;
    }
    // Try to stringify for debugging
    try {
      const stringified = JSON.stringify(error);
      if (stringified && stringified !== '{}') {
        return `Error: ${stringified}`;
      }
    } catch {
      // Ignore JSON.stringify errors
    }
  }
  return 'An unknown error occurred';
}

/**
 * Formats error for user display
 * Provides user-friendly error messages with actionable guidance
 */
function formatUserMessage(error: unknown, context?: ErrorContext): string {
  const message = extractErrorMessage(error);
  
  // Handle specific error types with user-friendly messages
  if (message.includes('CORS') || message.includes('cross-origin')) {
    return 'Connection error: Unable to fetch data. Please check your internet connection and try again.';
  }
  
  if (message.includes('timeout') || message.includes('408')) {
    return 'Request timeout: The server took too long to respond. Please try again.';
  }
  
  if (message.includes('404') || message.includes('not found')) {
    return 'Resource not found: The requested data could not be found.';
  }
  
  if (message.includes('401') || message.includes('403') || message.includes('unauthorized')) {
    return 'Access denied: You do not have permission to access this resource.';
  }
  
  if (message.includes('QuotaExceededError') || message.includes('quota')) {
    return 'Storage limit reached: Please clear some browser data and try again.';
  }
  
  if (message.includes('NetworkError') || message.includes('Failed to fetch')) {
    return 'Network error: Unable to connect to the server. Please check your internet connection.';
  }
  
  if (message.includes('Firebase') || message.includes('firebase')) {
    return 'Configuration error: Please check your Firebase configuration.';
  }
  
  // Generic fallback
  if (context?.operation) {
    return `Failed to ${context.operation}. ${message}`;
  }
  
  return message;
}

/**
 * Formats an error with context for consistent error handling
 * 
 * Extracts error messages from various error types (Error, string, objects)
 * and provides both technical and user-friendly messages. This ensures
 * consistent error handling throughout the application.
 * 
 * @param error - The error to format (Error, string, or unknown)
 * @param context - Optional context about where/why the error occurred
 * @returns Formatted error object with message, userMessage, and context
 * 
 * @example
 * ```typescript
 * try {
 *   await fetchData();
 * } catch (error) {
 *   const formatted = formatError(error, {
 *     operation: 'fetch stock data',
 *     component: 'useScoreBoardData',
 *     additionalInfo: { sheetName: 'DashBoard' }
 *   });
 *   console.error(formatted.message); // Technical message
 *   showToast(formatted.userMessage); // User-friendly message
 * }
 * ```
 */
export function formatError(error: unknown, context?: ErrorContext): FormattedError {
  const message = extractErrorMessage(error);
  const userMessage = formatUserMessage(error, context);
  
  return {
    message,
    userMessage,
    context: context || {},
    originalError: error,
  };
}

/**
 * Logs an error consistently using the centralized logger
 * 
 * Formats the error and logs it with appropriate context. This ensures
 * all errors are logged in a consistent format for debugging and monitoring.
 * 
 * @param error - The error to log
 * @param context - Optional context about where/why the error occurred
 * 
 * @example
 * ```typescript
 * try {
 *   await saveUserData(data);
 * } catch (error) {
 *   logError(error, {
 *     operation: 'save user data',
 *     component: 'UserProfile',
 *     additionalInfo: { userId: user.id }
 *   });
 *   // Error is automatically logged with context
 * }
 * ```
 */
export function logError(error: unknown, context?: ErrorContext): void {
  const formatted = formatError(error, context);
  
  // Use centralized logger instead of console.error
  logger.error(
    formatted.message,
    error instanceof Error ? error : new Error(formatted.message),
    {
      component: context?.component,
      operation: context?.operation,
      ...formatted.context.additionalInfo,
    }
  );
}

/**
 * Creates an error handler function for async operations
 * 
 * Returns a reusable error handler function that automatically logs
 * and formats errors with the provided context. Useful for creating
 * consistent error handling in async functions.
 * 
 * @param context - Context about the operation
 * @returns A function that handles errors and returns a formatted error
 * 
 * @example
 * ```typescript
 * const handleTransformError = createErrorHandler({
 *   operation: 'transform data',
 *   component: 'dataTransformers'
 * });
 * 
 * try {
 *   return transformData(rawData);
 * } catch (error) {
 *   const formatted = handleTransformError(error);
 *   throw new Error(formatted.message);
 * }
 * ```
 */
export function createErrorHandler(context: ErrorContext) {
  return (error: unknown): FormattedError => {
    logError(error, context);
    return formatError(error, context);
  };
}

/**
 * Wraps an async function with standardized error handling
 * 
 * Automatically catches errors, logs them, and re-throws formatted errors.
 * This provides a clean way to add error handling to existing async functions
 * without modifying their implementation.
 * 
 * @param fn - The async function to wrap
 * @param context - Context about the operation
 * @returns A function that catches errors and returns them in a standardized format
 * 
 * @example
 * ```typescript
 * const fetchWithErrorHandling = withErrorHandling(
 *   async (url: string) => {
 *     const response = await fetch(url);
 *     return response.json();
 *   },
 *   { operation: 'fetch data', component: 'apiService' }
 * );
 * 
 * // Errors are automatically logged and formatted
 * const data = await fetchWithErrorHandling('/api/stocks');
 * ```
 */
export function withErrorHandling<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  context: ErrorContext
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error: unknown) {
      logError(error, context);
      throw formatError(error, context);
    }
  }) as T;
}

/**
 * Checks if an error is a specific type
 */
export function isErrorType(error: unknown, type: string): boolean {
  if (error instanceof Error) {
    return error.name === type || error.message.includes(type);
  }
  if (typeof error === 'string') {
    return error.includes(type);
  }
  return false;
}

/**
 * Checks if an error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  return isErrorType(error, 'NetworkError') ||
         isErrorType(error, 'Failed to fetch') ||
         isErrorType(error, 'CORS') ||
         isErrorType(error, 'timeout');
}

/**
 * Checks if an error is a quota/storage error
 */
export function isQuotaError(error: unknown): boolean {
  return isErrorType(error, 'QuotaExceededError') ||
         isErrorType(error, 'quota');
}
