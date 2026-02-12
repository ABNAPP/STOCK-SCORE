/**
 * Steg C: Tests that fetchJSONData is blocked in secure mode.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SecurityError } from '../../../utils/securityErrors';

const mockIsSecureMode = vi.fn(() => false);
vi.mock('../../../config/securityMode', () => ({
  isSecureMode: () => mockIsSecureMode(),
}));

// Must import after mock so fetchJson gets mocked securityMode
import { fetchJSONData } from '../fetchJson';

describe('fetchJson secure mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSecureMode.mockReturnValue(false);
  });

  it('throws SecurityError in secure mode before any fetch', async () => {
    mockIsSecureMode.mockReturnValue(true);

    const mockTransformer = vi.fn((r: { data: unknown[] }) => r.data);

    await expect(
      fetchJSONData('DashBoard', 'Test', mockTransformer, undefined, undefined, true)
    ).rejects.toThrow(SecurityError);

    await expect(
      fetchJSONData('DashBoard', 'Test', mockTransformer, undefined, undefined, true)
    ).rejects.toThrow(/Secure mode: legacy GET to Apps Script is disabled/);
  });

  it('does not throw SecurityError in open mode', async () => {
    mockIsSecureMode.mockReturnValue(false);

    // Mock fetch so we don't hang - fetchJSONData may throw for other reasons (format, etc)
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([['H1', 'H2'], ['v1', 'v2']]),
    } as unknown as Response);

    const mockTransformer = vi.fn((r: { data: unknown[] }) => r.data);

    try {
      await fetchJSONData('DashBoard', 'Test', mockTransformer, undefined, undefined, true);
    } catch (e) {
      expect(e).not.toBeInstanceOf(SecurityError);
      expect((e as Error).name).not.toBe('SecurityError');
    }
  });
});
