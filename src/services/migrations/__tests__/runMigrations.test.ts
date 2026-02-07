/**
 * Unit tests for runMigrations.
 * Verifies idempotency and that migrations run as expected.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { migrateFromLocalStorage } from '../migrateFromLocalStorage';
import { runPreAuthMigrations, runPostAuthMigrations } from '../runMigrations';

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../firestoreCacheService', () => ({
  migrateCoreBoardToScoreBoard: vi.fn().mockResolvedValue(true),
  runTruncatedCacheMigrations: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../appConfigService', () => ({
  getApiKeysFromFirestore: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../config/apiKeys', () => ({
  setApiKeysCacheFromFirestore: vi.fn(),
}));

import { migrateCoreBoardToScoreBoard, runTruncatedCacheMigrations } from '../../firestoreCacheService';
import { getApiKeysFromFirestore } from '../../appConfigService';
import { setApiKeysCacheFromFirestore } from '../../../config/apiKeys';

describe('migrateFromLocalStorage', () => {
  const MIGRATION_FLAG = 'cache:migrated-to-firestore';

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should clear cache keys and set migration flag on first run', () => {
    localStorage.setItem('cache:scoreBoard', 'old-data');
    localStorage.setItem('cache:other', 'data');

    migrateFromLocalStorage();

    expect(localStorage.getItem('cache:scoreBoard')).toBeNull();
    expect(localStorage.getItem('cache:other')).toBeNull();
    expect(localStorage.getItem(MIGRATION_FLAG)).toBe('true');
  });

  it('should be idempotent - second run does nothing', () => {
    localStorage.setItem('cache:test', 'data');
    migrateFromLocalStorage();
    localStorage.setItem('cache:new-key', 'new-data'); // Simulate new cache between runs
    migrateFromLocalStorage();

    // Second run should not clear - flag already set, so it returns early
    expect(localStorage.getItem('cache:new-key')).toBe('new-data');
  });

  it('should clear currency_rates_usd', () => {
    localStorage.setItem('currency_rates_usd', 'rates');

    migrateFromLocalStorage();

    expect(localStorage.getItem('currency_rates_usd')).toBeNull();
  });
});

describe('runPreAuthMigrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should run without throwing', () => {
    runPreAuthMigrations();
    runPreAuthMigrations(); // Idempotent - second call fine
  });
});

describe('runPostAuthMigrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(migrateCoreBoardToScoreBoard).mockResolvedValue(true);
    vi.mocked(runTruncatedCacheMigrations).mockResolvedValue(undefined);
  });

  it('should run Firestore migrations', async () => {
    await runPostAuthMigrations();

    expect(migrateCoreBoardToScoreBoard).toHaveBeenCalledTimes(1);
    expect(runTruncatedCacheMigrations).toHaveBeenCalledTimes(1);
  });

  it('should not throw when Firestore migration fails', async () => {
    vi.mocked(migrateCoreBoardToScoreBoard).mockRejectedValue(new Error('Firestore error'));

    await expect(runPostAuthMigrations()).resolves.not.toThrow();
  });

  it('should load API keys', async () => {
    vi.mocked(getApiKeysFromFirestore).mockResolvedValue({ someKey: 'value' });

    await runPostAuthMigrations();

    expect(getApiKeysFromFirestore).toHaveBeenCalledTimes(1);
    expect(setApiKeysCacheFromFirestore).toHaveBeenCalledWith({ someKey: 'value' });
  });
});
