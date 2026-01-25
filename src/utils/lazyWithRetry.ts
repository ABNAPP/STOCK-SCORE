import { lazy, ComponentType, LazyExoticComponent } from 'react';
import { logger } from './logger';

/**
 * Wraps React.lazy() with retry logic for dynamic imports.
 * Handles transient "Failed to fetch dynamically imported module" errors
 * that can occur in Vite dev (HMR, network blips, etc.).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  componentName = 'module',
  retries = 2,
  intervalMs = 500
): LazyExoticComponent<T> {
  return lazy(async () => {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await importFn();
      } catch (e) {
        lastErr = e;
        if (attempt < retries) {
          logger.warn(`Retrying dynamic import for ${componentName} (attempt ${attempt + 1}/${retries})`, {
            component: 'lazyWithRetry',
            operation: 'import',
            error: e,
          });
          await new Promise((r) => setTimeout(r, intervalMs));
        }
      }
    }
    throw lastErr;
  }) as LazyExoticComponent<T>;
}
