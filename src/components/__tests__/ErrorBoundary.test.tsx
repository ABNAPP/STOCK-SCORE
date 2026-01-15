import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';
import i18n from '../../i18n/config';

// Mock i18n
vi.mock('../../i18n/config', () => ({
  default: {
    t: (key: string) => {
      const translations: Record<string, string> = {
        'errorBoundary.configurationError': 'Configuration Error',
        'errorBoundary.unknownError': 'An unknown error occurred',
        'errorBoundary.reloadPage': 'Reload Page',
      };
      return translations[key] || key;
    },
  },
}));

// Component that throws an error
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
}

describe('ErrorBoundary', () => {
  // Suppress console.error for error boundary tests
  const originalError = console.error;
  beforeAll(() => {
    console.error = vi.fn();
  });

  afterAll(() => {
    console.error = originalError;
  });

  it('should render children when there is no error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('should render error UI when there is an error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Configuration Error/i)).toBeInTheDocument();
  });

  it('should display error message', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Test error/i)).toBeInTheDocument();
  });

  it('should display reload button', () => {
    const reloadSpy = vi.spyOn(window.location, 'reload').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const reloadButton = screen.getByText(/Reload Page/i);
    expect(reloadButton).toBeInTheDocument();

    reloadSpy.mockRestore();
  });

  it('should handle Firebase configuration errors', () => {
    function ThrowFirebaseError() {
      throw new Error('Firebase configuration error');
    }

    render(
      <ErrorBoundary>
        <ThrowFirebaseError />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Configuration Error/i)).toBeInTheDocument();
  });

  it('should handle provider context errors', () => {
    function ThrowProviderError() {
      throw new Error('useRefresh must be used within a RefreshProvider');
    }

    render(
      <ErrorBoundary>
        <ThrowProviderError />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Configuration Error/i)).toBeInTheDocument();
  });

  it('should handle unknown errors', () => {
    function ThrowUnknownError() {
      throw new Error('Some other error');
    }

    render(
      <ErrorBoundary>
        <ThrowUnknownError />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Configuration Error/i)).toBeInTheDocument();
  });

  it('should log errors to console', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
