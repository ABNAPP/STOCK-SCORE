// Test setup file for Vitest
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { setupStableIntl } from './utils/determinism';

// Mock localStorage (Storage interface with length + key for migrations)
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] ?? null;
    },
  };
})();

// Mock sessionStorage (same structure as localStorage; reset between tests)
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] ?? null;
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});

// Stub window.confirm so tests never hang; default false (cancel)
if (typeof window !== 'undefined') {
  (window as Window & { confirm: ReturnType<typeof vi.fn> }).confirm = vi.fn().mockReturnValue(false);
}

// Stub ResizeObserver / IntersectionObserver / requestAnimationFrame for CI and headless (VirtualTableBody etc.)
if (typeof globalThis !== 'undefined') {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (typeof globalThis.IntersectionObserver === 'undefined') {
    globalThis.IntersectionObserver = class IntersectionObserver {
      constructor(_callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {}
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
}
if (typeof window !== 'undefined') {
  if (typeof window.requestAnimationFrame === 'undefined') {
    window.requestAnimationFrame = (cb: FrameRequestCallback) => window.setTimeout(cb, 0) as unknown as number;
  }
  if (typeof window.cancelAnimationFrame === 'undefined') {
    window.cancelAnimationFrame = (id: number) => window.clearTimeout(id);
  }
}

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Stable timezone for deterministic snapshots and date formatting
setupStableIntl();

// Cleanup after each test
afterEach(() => {
  cleanup();
  localStorageMock.clear();
  sessionStorageMock.clear();
});

