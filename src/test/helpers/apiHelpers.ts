/**
 * API Test Helpers
 * 
 * Provides helper functions for mocking API calls in tests.
 */

import { vi } from 'vitest';
import {
  createMockAppsScriptResponse,
  createMockCSVResponse,
  createMockErrorResponse,
  createMockNetworkError,
  createSampleAppsScriptData,
} from '../fixtures/mockApi';

/**
 * Mock successful fetch response
 */
export function mockFetchSuccess(data: unknown[][] | Response) {
  if (data instanceof Response) {
    global.fetch = vi.fn().mockResolvedValue(data);
  } else {
    global.fetch = vi.fn().mockResolvedValue(createMockAppsScriptResponse(data));
  }
}

/**
 * Mock fetch error response
 */
export function mockFetchError(status: number, statusText: string, body?: unknown) {
  global.fetch = vi.fn().mockResolvedValue(createMockErrorResponse(status, statusText, body));
}

/**
 * Mock fetch network error
 */
export function mockFetchNetworkError(message: string = 'Failed to fetch') {
  global.fetch = vi.fn().mockRejectedValue(createMockNetworkError(message));
}

/**
 * Mock Apps Script API response
 */
export function mockAppsScriptResponse(headers: string[], rows: unknown[][]) {
  const data = createSampleAppsScriptData(headers, rows);
  mockFetchSuccess(data);
}

/**
 * Mock CSV proxy response
 */
export function mockCSVResponse(csvData: string) {
  global.fetch = vi.fn().mockResolvedValue(createMockCSVResponse(csvData));
}

/**
 * Reset fetch mock
 */
export function resetFetchMock() {
  vi.restoreAllMocks();
  global.fetch = vi.fn();
}

/**
 * Create a delay mock for testing timeouts
 */
export function mockFetchDelay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
