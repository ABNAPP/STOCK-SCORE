import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadSharedThresholdValues,
  saveSharedThresholdValues,
  loadFromLocalStorage,
  saveToLocalStorage,
} from '../sharedThresholdService';
import { User } from 'firebase/auth';

const mockSetDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockServerTimestamp = vi.fn(() => ({ _methodName: 'serverTimestamp' }));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, col: string, id: string) => ({ _path: { segments: [col, id] } })),
  setDoc: vi.fn((...args: unknown[]) => mockSetDoc(...args)),
  getDoc: vi.fn((...args: unknown[]) => mockGetDoc(...args)),
  serverTimestamp: vi.fn(() => mockServerTimestamp()),
}));

vi.mock('../../config/firebase', () => ({
  db: {},
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('sharedThresholdService', () => {
  const mockUser: User = {
    uid: 'test-admin-id',
    email: 'admin@example.com',
  } as User;

  const testValues = {
    Technology: {
      irr: 15,
      leverageF2Min: 0.5,
      leverageF2Max: 2.0,
      ro40Min: 10,
      ro40Max: 20,
      cashSdebtMin: 0.5,
      cashSdebtMax: 1.5,
      currentRatioMin: 1.0,
      currentRatioMax: 2.0,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('saveSharedThresholdValues', () => {
    it('throws when userRole is not admin', async () => {
      await expect(
        saveSharedThresholdValues(testValues, { user: mockUser, userRole: 'viewer' })
      ).rejects.toThrow('sharedThreshold.saveDenied');

      await expect(
        saveSharedThresholdValues(testValues, { user: mockUser, userRole: null })
      ).rejects.toThrow('sharedThreshold.saveDenied');

      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it('throws when user is null', async () => {
      await expect(
        saveSharedThresholdValues(testValues, { user: null, userRole: 'admin' })
      ).rejects.toThrow('sharedThreshold.saveDenied');

      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it('writes to Firestore when userRole is admin', async () => {
      mockSetDoc.mockResolvedValue(undefined);

      await saveSharedThresholdValues(testValues, { user: mockUser, userRole: 'admin' });

      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.any(Object),
        {
          values: testValues,
          updatedAt: expect.any(Object),
          updatedBy: mockUser.uid,
        },
        { merge: true }
      );
    });

    it('saves to localStorage after successful Firestore write', async () => {
      mockSetDoc.mockResolvedValue(undefined);

      await saveSharedThresholdValues(testValues, { user: mockUser, userRole: 'admin' });

      const stored = localStorage.getItem('sharedThresholdValues');
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!)).toEqual(testValues);
    });
  });

  describe('loadSharedThresholdValues', () => {
    it('returns data from Firestore when user is authenticated', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ values: testValues }),
      });

      const result = await loadSharedThresholdValues(mockUser);

      expect(result).toEqual(testValues);
      expect(mockGetDoc).toHaveBeenCalled();
    });

    it('returns localStorage data when user is null', async () => {
      localStorage.setItem('sharedThresholdValues', JSON.stringify(testValues));

      const result = await loadSharedThresholdValues(null);

      expect(result).toEqual(testValues);
      expect(mockGetDoc).not.toHaveBeenCalled();
    });

    it('returns null when no data exists', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
        data: () => null,
      });

      const result = await loadSharedThresholdValues(mockUser);

      expect(result).toBeNull();
    });

    it('falls back to localStorage when Firestore fails', async () => {
      mockGetDoc.mockRejectedValue(new Error('Firestore error'));
      localStorage.setItem('sharedThresholdValues', JSON.stringify(testValues));

      const result = await loadSharedThresholdValues(mockUser);

      expect(result).toEqual(testValues);
    });
  });

  describe('loadFromLocalStorage', () => {
    it('migrates from legacy thresholdValues key', () => {
      localStorage.setItem('thresholdValues', JSON.stringify(testValues));

      const result = loadFromLocalStorage();

      expect(result).toEqual(testValues);
      expect(localStorage.getItem('sharedThresholdValues')).toBeTruthy();
    });

    it('returns null when no data exists', () => {
      expect(loadFromLocalStorage()).toBeNull();
    });
  });

  describe('saveToLocalStorage', () => {
    it('saves values to localStorage', () => {
      saveToLocalStorage(testValues);

      const stored = localStorage.getItem('sharedThresholdValues');
      expect(JSON.parse(stored!)).toEqual(testValues);
    });
  });
});
