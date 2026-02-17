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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be a no-op (Firestore is the only data source)', () => {
    migrateFromLocalStorage();
    migrateFromLocalStorage();
    // No-op - does not throw
  });
});

describe('runPreAuthMigrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
