/**
 * API Mock Fixtures
 * 
 * Provides mock implementations of API responses for testing.
 */

import { vi } from 'vitest';

/**
 * Create a mock successful Apps Script API response
 */
export function createMockAppsScriptResponse(data: unknown[][]) {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
  } as Response;
}

/**
 * Create a mock CSV proxy response
 */
export function createMockCSVResponse(csvData: string) {
  return {
    ok: true,
    status: 200,
    text: vi.fn().mockResolvedValue(csvData),
  } as Response;
}

/**
 * Create a mock error response
 */
export function createMockErrorResponse(status: number, statusText: string, body?: unknown) {
  return {
    ok: false,
    status,
    statusText,
    json: vi.fn().mockResolvedValue(body || { error: statusText }),
    text: vi.fn().mockResolvedValue(JSON.stringify(body || { error: statusText })),
  } as Response;
}

/**
 * Create a mock network error
 */
export function createMockNetworkError(message: string = 'Failed to fetch') {
  return new TypeError(message);
}

/**
 * Create a mock timeout error
 */
export function createMockTimeoutError() {
  return new Error('Request timeout after 30 seconds');
}

/**
 * Mock fetch for successful Apps Script response
 */
export function mockFetchSuccess(data: unknown[][]) {
  global.fetch = vi.fn().mockResolvedValue(createMockAppsScriptResponse(data));
}

/**
 * Mock fetch for error response
 */
export function mockFetchError(status: number, statusText: string) {
  global.fetch = vi.fn().mockResolvedValue(createMockErrorResponse(status, statusText));
}

/**
 * Mock fetch for network error
 */
export function mockFetchNetworkError() {
  global.fetch = vi.fn().mockRejectedValue(createMockNetworkError());
}

/**
 * Create sample Apps Script 2D array response
 */
export function createSampleAppsScriptData(headers: string[], rows: unknown[][]) {
  return [headers, ...rows];
}

/**
 * Create sample CSV data
 */
export function createSampleCSVData(headers: string[], rows: unknown[][]) {
  const csvRows = [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ];
  return csvRows.join('\n');
}
