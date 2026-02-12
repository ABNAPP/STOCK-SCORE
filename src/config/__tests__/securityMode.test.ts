import { describe, it, expect, vi, afterEach } from 'vitest';

describe('securityMode', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  describe('isSecureMode', () => {
    it('returns true when VITE_APPS_SCRIPT_TOKEN is set', async () => {
      vi.stubEnv('VITE_APPS_SCRIPT_TOKEN', 'secret');
      vi.stubEnv('VITE_APPS_SCRIPT_SECURE_MODE', '');
      vi.resetModules();

      const { isSecureMode } = await import('../securityMode');
      expect(isSecureMode()).toBe(true);
    });

    it('returns true when VITE_APPS_SCRIPT_SECURE_MODE is "true"', async () => {
      vi.stubEnv('VITE_APPS_SCRIPT_TOKEN', '');
      vi.stubEnv('VITE_APPS_SCRIPT_SECURE_MODE', 'true');
      vi.resetModules();

      const { isSecureMode } = await import('../securityMode');
      expect(isSecureMode()).toBe(true);
    });

    it('returns false when both token and secure flag are unset', async () => {
      vi.stubEnv('VITE_APPS_SCRIPT_TOKEN', '');
      vi.stubEnv('VITE_APPS_SCRIPT_SECURE_MODE', '');
      vi.resetModules();

      const { isSecureMode } = await import('../securityMode');
      expect(isSecureMode()).toBe(false);
    });
  });

  describe('requireProxyInSecureMode', () => {
    it('throws when secure mode, APPS_SCRIPT_URL set, proxy empty', async () => {
      vi.stubEnv('VITE_APPS_SCRIPT_TOKEN', 'secret');
      vi.stubEnv('VITE_APPS_SCRIPT_URL', 'https://script.google.com/macros/s/ABC/exec');
      vi.stubEnv('VITE_APPS_SCRIPT_PROXY_URL', '');
      vi.resetModules();

      const { requireProxyInSecureMode } = await import('../securityMode');
      expect(() => requireProxyInSecureMode()).toThrow(/VITE_APPS_SCRIPT_PROXY_URL is required/);
    });

    it('does not throw when proxy is configured in secure mode', async () => {
      vi.stubEnv('VITE_APPS_SCRIPT_TOKEN', 'secret');
      vi.stubEnv('VITE_APPS_SCRIPT_URL', 'https://script.google.com/macros/s/ABC/exec');
      vi.stubEnv('VITE_APPS_SCRIPT_PROXY_URL', 'https://proxy.example.com/exec');
      vi.resetModules();

      const { requireProxyInSecureMode } = await import('../securityMode');
      expect(() => requireProxyInSecureMode()).not.toThrow();
    });

    it('does not throw when not in secure mode (no URL check)', async () => {
      vi.stubEnv('VITE_APPS_SCRIPT_TOKEN', '');
      vi.stubEnv('VITE_APPS_SCRIPT_SECURE_MODE', '');
      vi.stubEnv('VITE_APPS_SCRIPT_URL', 'https://script.google.com/macros/s/ABC/exec');
      vi.stubEnv('VITE_APPS_SCRIPT_PROXY_URL', '');
      vi.resetModules();

      const { requireProxyInSecureMode } = await import('../securityMode');
      expect(() => requireProxyInSecureMode()).not.toThrow();
    });
  });
});
