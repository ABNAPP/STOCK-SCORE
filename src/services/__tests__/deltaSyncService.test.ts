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

  describe('getApiBaseUrlForDeltaSync', () => {
    it('throws when token is set, apiBaseUrl is direct Apps Script, and proxy URL is not configured', async () => {
      vi.stubEnv('VITE_APPS_SCRIPT_TOKEN', 'secret');
      vi.stubEnv('VITE_APPS_SCRIPT_PROXY_URL', '');
      vi.stubEnv('VITE_APPS_SCRIPT_URL', 'https://script.google.com/macros/s/ABC/exec');
      vi.resetModules();

      const { getApiBaseUrlForDeltaSync: getUrl } = await import('../deltaSyncService');

      expect(() => getUrl()).toThrow(/VITE_APPS_SCRIPT_PROXY_URL is required|Direct Apps Script calls are not allowed/);

      vi.unstubAllEnvs();
      vi.resetModules();
    });

    it('Steg C: throws when VITE_APPS_SCRIPT_SECURE_MODE=true, URL set, proxy empty', async () => {
      vi.stubEnv('VITE_APPS_SCRIPT_TOKEN', '');
      vi.stubEnv('VITE_APPS_SCRIPT_SECURE_MODE', 'true');
      vi.stubEnv('VITE_APPS_SCRIPT_PROXY_URL', '');
      vi.stubEnv('VITE_APPS_SCRIPT_URL', 'https://script.google.com/macros/s/ABC/exec');
      vi.resetModules();

      const { getApiBaseUrlForDeltaSync: getUrl } = await import('../deltaSyncService');

      expect(() => getUrl()).toThrow(/VITE_APPS_SCRIPT_PROXY_URL is required/);

      vi.unstubAllEnvs();
      vi.resetModules();
    });

    it('Steg C: returns proxy URL when secure mode and proxy configured', async () => {
      vi.stubEnv('VITE_APPS_SCRIPT_SECURE_MODE', 'true');
      vi.stubEnv('VITE_APPS_SCRIPT_PROXY_URL', 'https://proxy.example.com/exec');
      vi.stubEnv('VITE_APPS_SCRIPT_URL', 'https://script.google.com/macros/s/ABC/exec');
      vi.resetModules();

      const { getApiBaseUrlForDeltaSync: getUrl } = await import('../deltaSyncService');

      expect(getUrl()).toBe('https://proxy.example.com/exec');

      vi.unstubAllEnvs();
      vi.resetModules();
    });

    it('returns proxy URL when token and proxy are configured', async () => {
      vi.stubEnv('VITE_APPS_SCRIPT_TOKEN', 'secret');
      vi.stubEnv('VITE_APPS_SCRIPT_PROXY_URL', 'https://proxy.example.com/exec');
      vi.stubEnv('VITE_APPS_SCRIPT_URL', 'https://script.google.com/macros/s/ABC/exec');
      vi.resetModules();

      const { getApiBaseUrlForDeltaSync: getUrl } = await import('../deltaSyncService');

      expect(getUrl()).toBe('https://proxy.example.com/exec');

      vi.unstubAllEnvs();
      vi.resetModules();
    });

    it('returns Apps Script URL when no token', async () => {
      vi.stubEnv('VITE_APPS_SCRIPT_TOKEN', '');
      vi.stubEnv('VITE_APPS_SCRIPT_PROXY_URL', '');
      vi.stubEnv('VITE_APPS_SCRIPT_URL', 'https://script.google.com/macros/s/ABC/exec');
      vi.resetModules();

      const { getApiBaseUrlForDeltaSync: getUrl } = await import('../deltaSyncService');

      expect(getUrl()).toBe('https://script.google.com/macros/s/ABC/exec');

      vi.unstubAllEnvs();
      vi.resetModules();
    });
  });

  describe('loadSnapshot token handling', () => {
    it('should NOT put token in URL or body when token is set (use POST with token in header only)', async () => {
      const config: DeltaSyncConfig = {
        sheetName: 'TestSheet',
        apiBaseUrl: 'https://script.google.com/macros/s/test/exec',
        token: 'secret-token',
      };

      const snapshot: SnapshotResponse = {
        ok: true,
        version: 1,
        headers: ['col1', 'col2'],
        rows: [],
        generatedAt: new Date().toISOString(),
      };

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(snapshot),
      } as unknown as Response);
      global.fetch = fetchSpy;

      await loadSnapshot(config);

      expect(fetchSpy).toHaveBeenCalled();
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).not.toContain('token=');
      expect(url).toBe('https://script.google.com/macros/s/test/exec');
      expect(init?.method).toBe('POST');
      const body = JSON.parse((init?.body as string) || '{}');
      expect(body.action).toBe('snapshot');
      expect(body.sheet).toBe('TestSheet');
      // Steg B.1: token must NOT be in body when Authorization header is used
      expect(body).not.toHaveProperty('token');
      // Authorization header must be set when token is used
      const headers = init?.headers as Record<string, string> | undefined;
      expect(headers?.['Authorization']).toBe('Bearer secret-token');
      expect(headers?.['Accept']).toBe('application/json');
    });

    it('should use GET without token in URL when no token', async () => {
      const config: DeltaSyncConfig = {
        sheetName: 'TestSheet',
        apiBaseUrl: 'https://script.google.com/macros/s/test/exec',
      };

      const snapshot: SnapshotResponse = {
        ok: true,
        version: 1,
        headers: ['col1', 'col2'],
        rows: [],
        generatedAt: new Date().toISOString(),
      };

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(snapshot),
      } as unknown as Response);
      global.fetch = fetchSpy;

      await loadSnapshot(config);

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).not.toContain('token=');
      expect(init?.method).toBe('GET');
    });

    it('should NOT put token in body when pollChanges uses token (header only)', async () => {
      const config: DeltaSyncConfig = {
        sheetName: 'TestSheet',
        apiBaseUrl: 'https://script.google.com/macros/s/test/exec',
        token: 'secret-token',
      };

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          ok: true,
          fromVersion: 0,
          toVersion: 1,
          changes: [],
        }),
      } as unknown as Response);
      global.fetch = fetchSpy;

      await pollChanges(config, 0);

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).not.toContain('token=');
      expect(init?.method).toBe('POST');
      const body = JSON.parse((init?.body as string) || '{}');
      expect(body).not.toHaveProperty('token');
      expect(body.action).toBe('changes');
      expect(body.sheet).toBe('TestSheet');
      expect(body.since).toBe(0);
      const headers = init?.headers as Record<string, string> | undefined;
      expect(headers?.['Authorization']).toBe('Bearer secret-token');
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
