import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import './i18n/config'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { logger } from './utils/logger'
import { validateEnvironmentVariables } from './utils/envValidator'
import { registerServiceWorker } from './utils/serviceWorkerRegistration'

/**
 * Filter out browser extension errors that don't affect the application
 * These errors come from content scripts injected by browser extensions
 * (password managers, form fillers, accessibility tools, etc.)
 */
function isBrowserExtensionError(error: ErrorEvent | PromiseRejectionEvent | Error): boolean {
  let errorMessage = '';
  let errorSource = '';
  let errorStack = '';
  
  if (error instanceof ErrorEvent) {
    errorMessage = error.message || '';
    errorSource = error.filename || '';
    errorStack = error.error?.stack || '';
  } else if (error instanceof PromiseRejectionEvent) {
    const reason = error.reason;
    if (reason instanceof Error) {
      errorMessage = reason.message || '';
      errorStack = reason.stack || '';
      // Also check if the error object itself has extension patterns
      const errorString = String(reason);
      if (errorString) {
        errorMessage += ' ' + errorString;
      }
    } else {
      errorMessage = String(reason);
    }
  } else if (error instanceof Error) {
    errorMessage = error.message || '';
    errorStack = error.stack || '';
  } else {
    errorMessage = String(error);
  }
  
  // Combine all error information for pattern matching
  const combinedText = `${errorMessage} ${errorSource} ${errorStack}`.toLowerCase();
  
  // Common patterns for browser extension errors
  const extensionPatterns = [
    'content-script',
    'web-client-content-script',
    'chrome-extension',
    'moz-extension',
    'safari-extension',
    'edge-extension',
    'could not find identifiable element',
    'extension context invalidated',
    'message handler closed',
    'receiving end does not exist',
    'webclient',
    'identifiable element',
  ];
  
  return extensionPatterns.some(pattern => combinedText.includes(pattern));
}

// Set up global error handlers to filter out browser extension errors
// IMPORTANT: Set these up as early as possible, before any other code runs
if (typeof window !== 'undefined') {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    if (isBrowserExtensionError(event)) {
      // Suppress browser extension errors
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    // Log legitimate errors
    logger.error(
      'Unhandled promise rejection',
      event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
      { component: 'main', type: 'unhandledrejection' }
    );
  }, true); // Use capture phase to catch early

  // Handle general errors
  window.addEventListener('error', (event) => {
    if (isBrowserExtensionError(event)) {
      // Suppress browser extension errors
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    // Log legitimate errors (ErrorBoundary will also catch React errors)
    if (event.error) {
      logger.error(
        'Unhandled error',
        event.error,
        { 
          component: 'main', 
          type: 'error',
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      );
    }
  }, true); // Use capture phase to catch early
}

// Validate environment variables before app initialization
try {
  const validationResult = validateEnvironmentVariables();
  if (!validationResult.isValid) {
    logger.error(
      'Environment validation failed',
      new Error(validationResult.errors.join('; ')),
      { component: 'main', validationResult }
    );
  }
} catch (error) {
  logger.error(
    'Critical environment validation error',
    error instanceof Error ? error : new Error(String(error)),
    { component: 'main' }
  );
  // Re-throw in production to prevent app from starting
  if (import.meta.env.PROD) {
    throw error;
  }
}

// Safely get root element
const rootElement = document.getElementById('root');

if (!rootElement) {
  logger.error(
    'Root element not found. Make sure index.html contains <div id="root"></div>',
    new Error('Root element missing'),
    { component: 'main', operation: 'initialize' }
  );
  throw new Error('Root element not found. Please check index.html');
}

// Register Service Worker
if (import.meta.env.PROD) {
  registerServiceWorker().catch((error) => {
    logger.warn('Service Worker registration failed', {
      component: 'main',
      error,
    });
  });
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <NotificationProvider>
                <App />
              </NotificationProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)

