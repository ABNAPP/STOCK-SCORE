/**
 * Determinism utilities for stable, reproducible tests.
 * Use these to eliminate flakiness from time, random, and locale.
 */

import { vi } from 'vitest';

/** Fixed timestamp: 2020-01-01T00:00:00.000Z */
export const FIXED_TIMESTAMP = 1577836800000;

/** Mulberry32 PRNG - deterministic seeded random */
function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let randomSpy: { mockRestore: () => void } | null = null;

/**
 * Run a function with a fixed clock (2020-01-01T00:00:00.000Z).
 * Restores timers after execution.
 */
export function withFixedClock<T>(fn: () => T): T {
  vi.useFakeTimers({ now: FIXED_TIMESTAMP });
  try {
    return fn();
  } finally {
    vi.useRealTimers();
  }
}

/**
 * Setup fixed clock for current test. Call teardownFixedClock in afterEach.
 */
export function setupFixedClock(): void {
  vi.useFakeTimers({ now: FIXED_TIMESTAMP });
}

/**
 * Restore real timers after setupFixedClock.
 */
export function teardownFixedClock(): void {
  vi.useRealTimers();
}

/**
 * Setup deterministic Math.random with optional seed.
 * Call teardownStableRandom in afterEach.
 */
export function setupStableRandom(seed = 1): void {
  const next = mulberry32(seed);
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(next);
}

/**
 * Restore original Math.random.
 */
export function teardownStableRandom(): void {
  randomSpy?.mockRestore();
  randomSpy = null;
}

/**
 * Alternative: mock Math.random to return a sequence of values.
 */
export function mockMathRandom(values: number[]): () => void {
  let i = 0;
  const spy = vi.spyOn(Math, 'random').mockImplementation(
    () => (i < values.length ? values[i++] : values[values.length - 1] ?? 0)
  );
  return () => spy.mockRestore();
}

/**
 * Setup stable Intl for tests (UTC timezone).
 * Should be called in setup.ts or beforeEach.
 */
export function setupStableIntl(): void {
  try {
    if (typeof process !== 'undefined' && process.env) {
      process.env.TZ = 'UTC';
    }
  } catch {
    // Ignore if process.env is not available (e.g. strict env)
  }
}

/** Captured log entries */
export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  args: unknown[];
}

/**
 * Setup logger mock that captures all console output.
 * Returns array of captured entries. Call teardownLoggerMock in afterEach.
 */
export function setupLoggerMock(): LogEntry[] {
  const capturedLogs: LogEntry[] = [];
  const log = (level: LogEntry['level']) => (...args: unknown[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : String(args[0]);
    capturedLogs.push({ level, message: msg, args });
  };
  vi.spyOn(console, 'debug').mockImplementation(log('debug'));
  vi.spyOn(console, 'info').mockImplementation(log('info'));
  vi.spyOn(console, 'warn').mockImplementation(log('warn'));
  vi.spyOn(console, 'error').mockImplementation(log('error'));
  return capturedLogs;
}

/**
 * Run a function and capture all console output.
 */
export function withLoggerCapture<T>(fn: () => T): { result: T; logs: LogEntry[] } {
  const logs: LogEntry[] = [];
  const log = (level: LogEntry['level']) => (...args: unknown[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : String(args[0]);
    logs.push({ level, message: msg, args });
  };
  const debugSpy = vi.spyOn(console, 'debug').mockImplementation(log('debug'));
  const infoSpy = vi.spyOn(console, 'info').mockImplementation(log('info'));
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(log('warn'));
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(log('error'));
  try {
    const result = fn();
    return { result, logs };
  } finally {
    debugSpy.mockRestore();
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  }
}

/**
 * Teardown logger mock.
 */
export function teardownLoggerMock(): void {
  vi.restoreAllMocks();
}

/**
 * Seed localStorage with key-value pairs. Use before test or in beforeEach.
 */
export function seedLocalStorage(entries: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  for (const [key, value] of Object.entries(entries)) {
    window.localStorage.setItem(key, value);
  }
}

/**
 * Read localStorage keys matching a prefix.
 */
export function readLocalStorageKeys(prefix: string): string[] {
  if (typeof window === 'undefined') return [];
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith(prefix)) keys.push(k);
  }
  return keys.sort();
}
