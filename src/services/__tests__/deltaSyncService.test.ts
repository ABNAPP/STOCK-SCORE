import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  initSync,
  pollChanges,
  loadSnapshot,
  applyChangesToCache,
  isDeltaSyncEnabled,
  getPollIntervalMs,
} from '../deltaSyncService';
import type { DeltaSyncConfig, SnapshotResponse, ChangesResponse } from '../deltaSyncService';

describe('deltaSyncService Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initSync error cases', () => {
    it('should handle network errors', async () => {
      const config: DeltaSyncConfig = {
        sheetName: 'TestSheet',
        apiBaseUrl: 'https://script.google.com/macros/s/test/exec',
      };

      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const transformer = vi.fn((results) => results.data);

      await expect(
        initSync(config, 'test-key', transformer)
      ).rejects.toThrow();
    });

    it('should handle 404 errors', async () => {
      const config: DeltaSyncConfig = {
        sheetName: 'TestSheet',
        apiBaseUrl: 'https://script.google.com/macros/s/test/exec',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: vi.fn().mockResolvedValue({ ok: false, error: 'Not found' }),
      } as unknown as Response);

      const transformer = vi.fn((results) => results.data);

      await expect(
        initSync(config, 'test-key', transformer)
      ).rejects.toThrow();
    });

    it('should handle invalid JSON response', async () => {
      const config: DeltaSyncConfig = {
        sheetName: 'TestSheet',
        apiBaseUrl: 'https://script.google.com/macros/s/test/exec',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
      } as unknown as Response);

      const transformer = vi.fn((results) => results.data);

      await expect(
        initSync(config, 'test-key', transformer)
      ).rejects.toThrow();
    });

    it('should handle snapshot with error flag', async () => {
      const config: DeltaSyncConfig = {
        sheetName: 'TestSheet',
        apiBaseUrl: 'https://script.google.com/macros/s/test/exec',
      };

      const errorResponse: SnapshotResponse = {
        ok: false,
        version: 0,
        headers: [],
        rows: [],
        generatedAt: new Date().toISOString(),
        error: 'Sheet not found',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(errorResponse),
      } as unknown as Response);

      const transformer = vi.fn((results) => results.data);

      await expect(
        initSync(config, 'test-key', transformer)
      ).rejects.toThrow(/error|Sheet not found/);
    });
  });

  describe('pollChanges error cases', () => {
    it('should handle AbortError (timeout)', async () => {
      const config: DeltaSyncConfig = {
        sheetName: 'TestSheet',
        apiBaseUrl: 'https://script.google.com/macros/s/test/exec',
      };

      const abortError = new Error('AbortError');
      abortError.name = 'AbortError';
      global.fetch = vi.fn().mockRejectedValue(abortError);

      await expect(
        pollChanges(config, 1)
      ).rejects.toThrow();
    });

    it('should handle HTTP 5xx errors with retry', async () => {
      const config: DeltaSyncConfig = {
        sheetName: 'TestSheet',
        apiBaseUrl: 'https://script.google.com/macros/s/test/exec',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      // Should retry and eventually fail
      await expect(
        pollChanges(config, 1)
      ).rejects.toThrow();
    });

    it('should handle changes response with error flag', async () => {
      const config: DeltaSyncConfig = {
        sheetName: 'TestSheet',
        apiBaseUrl: 'https://script.google.com/macros/s/test/exec',
      };

      const errorResponse: ChangesResponse = {
        ok: false,
        fromVersion: 1,
        toVersion: 1,
        changes: [],
        error: 'Invalid version',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(errorResponse),
      } as unknown as Response);

      await expect(
        pollChanges(config, 1)
      ).rejects.toThrow(/error|Invalid version/);
    });

    it('should handle needsFullResync flag', async () => {
      const config: DeltaSyncConfig = {
        sheetName: 'TestSheet',
        apiBaseUrl: 'https://script.google.com/macros/s/test/exec',
      };

      const resyncResponse: ChangesResponse = {
        ok: true,
        fromVersion: 1,
        toVersion: 5,
        changes: [],
        needsFullResync: true,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(resyncResponse),
      } as unknown as Response);

      const result = await pollChanges(config, 1);
      expect(result.needsFullResync).toBe(true);
    });
  });

  describe('loadSnapshot error cases', () => {
    it('should handle network errors', async () => {
      const config: DeltaSyncConfig = {
        sheetName: 'TestSheet',
        apiBaseUrl: 'https://script.google.com/macros/s/test/exec',
      };

      global.fetch = vi.fn().mockRejectedValue(new TypeError('Network error'));

      await expect(
        loadSnapshot(config)
      ).rejects.toThrow();
    });

    it('should handle invalid snapshot structure', async () => {
      const config: DeltaSyncConfig = {
        sheetName: 'TestSheet',
        apiBaseUrl: 'https://script.google.com/macros/s/test/exec',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          // Missing required fields
          ok: true,
        }),
      } as unknown as Response);

      await expect(
        loadSnapshot(config)
      ).rejects.toThrow();
    });
  });

  describe('applyChangesToCache error cases', () => {
    it('should handle invalid changes array', async () => {
      const changes: ChangesResponse = {
        ok: true,
        fromVersion: 1,
        toVersion: 2,
        changes: null as unknown as [],
      };

      await expect(applyChangesToCache(changes, 'test-key')).resolves.toBeDefined();
    });

    it('should handle changes with invalid row data', async () => {
      const changes: ChangesResponse = {
        ok: true,
        fromVersion: 1,
        toVersion: 2,
        changes: [
          {
            id: 1,
            tsISO: new Date().toISOString(),
            key: 'test-key',
            rowIndex: 0,
            changedColumns: ['col1'],
            values: null as unknown as [],
          },
        ],
      };

      await expect(applyChangesToCache(changes, 'test-key')).resolves.toBeDefined();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty sheet name', async () => {
      const config: DeltaSyncConfig = {
        sheetName: '',
        apiBaseUrl: 'https://script.google.com/macros/s/test/exec',
      };

      const transformer = vi.fn((results) => results.data);

      await expect(
        initSync(config, 'test-key', transformer)
      ).rejects.toThrow();
    });

    it('should handle invalid API base URL', async () => {
      const config: DeltaSyncConfig = {
        sheetName: 'TestSheet',
        apiBaseUrl: 'invalid-url',
      };

      const transformer = vi.fn((results) => results.data);

      await expect(
        initSync(config, 'test-key', transformer)
      ).rejects.toThrow();
    });

    it('should handle version 0', async () => {
      const config: DeltaSyncConfig = {
        sheetName: 'TestSheet',
        apiBaseUrl: 'https://script.google.com/macros/s/test/exec',
      };

      const snapshot: SnapshotResponse = {
        ok: true,
        version: 0,
        headers: ['col1', 'col2'],
        rows: [],
        generatedAt: new Date().toISOString(),
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(snapshot),
      } as unknown as Response);

      const transformer = vi.fn((results) => results.data);

      const result = await initSync(config, 'test-key', transformer);
      expect(result.version).toBe(0);
    });

    it('should handle negative version numbers', async () => {
      const config: DeltaSyncConfig = {
        sheetName: 'TestSheet',
        apiBaseUrl: 'https://script.google.com/macros/s/test/exec',
      };

      const snapshot: SnapshotResponse = {
        ok: true,
        version: -1,
        headers: ['col1'],
        rows: [],
        generatedAt: new Date().toISOString(),
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(snapshot),
      } as unknown as Response);

      const transformer = vi.fn((results) => results.data);

      const result = await initSync(config, 'test-key', transformer);
      expect(result.version).toBe(-1);
    });
  });
});
