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

