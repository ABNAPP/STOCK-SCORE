import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveEntryExitValues,
  loadEntryExitValues,
  saveCurrencyValues,
  loadCurrencyValues,
  saveThresholdValues,
  loadThresholdValues,
} from '../userDataService';
import { User } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

// Mock Firebase
const mockSetDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockServerTimestamp = vi.fn(() => ({ _methodName: 'serverTimestamp' }));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((db, collection, id) => ({ _path: { segments: [collection, id] } })),
  setDoc: vi.fn((...args) => mockSetDoc(...args)),
  getDoc: vi.fn((...args) => mockGetDoc(...args)),
  serverTimestamp: vi.fn(() => mockServerTimestamp()),
}));

vi.mock('../config/firebase', () => ({
  db: {},
}));

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('userDataService', () => {
  const mockUser: User = {
    uid: 'test-user-id',
    email: 'test@example.com',
  } as User;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('saveEntryExitValues', () => {
    const testValues = {
      'AAPL': {
        entry1: 150,
        entry2: 155,
        exit1: 160,
        exit2: 165,
        currency: 'USD',
        dateOfUpdate: '2024-01-01',
      },
      'MSFT': {
        entry1: 300,
        entry2: 305,
        exit1: 320,
        exit2: 325,
        currency: 'USD',
        dateOfUpdate: '2024-01-02',
      },
    };

    it('should save to Firestore when user is authenticated', async () => {
      mockSetDoc.mockResolvedValue(undefined);

      await saveEntryExitValues(mockUser, testValues);

      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.any(Object),
        {
          values: testValues,
          updatedAt: expect.any(Object),
        },
        { merge: true }
      );
    });

    it('should save to localStorage as backup when using Firestore', async () => {
      mockSetDoc.mockResolvedValue(undefined);

      await saveEntryExitValues(mockUser, testValues);

      const stored = localStorage.getItem('entryExitValues');
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!)).toEqual(testValues);
    });

    it('should fallback to localStorage when user is not authenticated', async () => {
      await saveEntryExitValues(null, testValues);

      expect(mockSetDoc).not.toHaveBeenCalled();
      const stored = localStorage.getItem('entryExitValues');
      expect(JSON.parse(stored!)).toEqual(testValues);
    });

    it('should fallback to localStorage when Firestore save fails', async () => {
      mockSetDoc.mockRejectedValue(new Error('Firestore error'));

      await saveEntryExitValues(mockUser, testValues);

      const stored = localStorage.getItem('entryExitValues');
      expect(JSON.parse(stored!)).toEqual(testValues);
    });

    it('should handle localStorage quota exceeded error', async () => {
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        const error = new DOMException('QuotaExceededError');
        error.name = 'QuotaExceededError';
        throw error;
      });

      mockSetDoc.mockResolvedValue(undefined);

      // Should not throw, but log error
      await expect(saveEntryExitValues(mockUser, testValues)).resolves.not.toThrow();

      localStorage.setItem = originalSetItem;
    });
  });

  describe('loadEntryExitValues', () => {
    it('should load from Firestore when user is authenticated', async () => {
      const testValues = {
        'AAPL': {
          entry1: 150,
          entry2: 155,
          exit1: 160,
          exit2: 165,
          currency: 'USD',
          dateOfUpdate: '2024-01-01',
        },
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ values: testValues }),
      });

      const result = await loadEntryExitValues(mockUser);

      expect(result).toEqual(testValues);
      expect(mockGetDoc).toHaveBeenCalled();
    });

    it('should fallback to localStorage when user is not authenticated', async () => {
      const testValues = {
        'AAPL': {
          entry1: 150,
          entry2: 155,
          exit1: 160,
          exit2: 165,
          currency: 'USD',
          dateOfUpdate: '2024-01-01',
        },
      };

      localStorage.setItem('entryExitValues', JSON.stringify(testValues));

      const result = await loadEntryExitValues(null);

      expect(result).toEqual(testValues);
      expect(mockGetDoc).not.toHaveBeenCalled();
    });

    it('should fallback to localStorage when Firestore load fails', async () => {
      const testValues = {
        'AAPL': {
          entry1: 150,
          entry2: 155,
          exit1: 160,
          exit2: 165,
          currency: 'USD',
          dateOfUpdate: '2024-01-01',
        },
      };

      mockGetDoc.mockRejectedValue(new Error('Firestore error'));
      localStorage.setItem('entryExitValues', JSON.stringify(testValues));

      const result = await loadEntryExitValues(mockUser);

      expect(result).toEqual(testValues);
    });

    it('should return null when no data exists', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
        data: () => null,
      });

      const result = await loadEntryExitValues(mockUser);

      expect(result).toBeNull();
    });

    it('should ensure all values have currency field', async () => {
      const testValues = {
        'AAPL': {
          entry1: 150,
          entry2: 155,
          exit1: 160,
          exit2: 165,
          currency: 'USD',
          dateOfUpdate: '2024-01-01',
        },
        'MSFT': {
          entry1: 300,
          entry2: 305,
          exit1: 320,
          exit2: 325,
          dateOfUpdate: '2024-01-02',
        } as any,
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ values: testValues }),
      });

      const result = await loadEntryExitValues(mockUser);

      expect(result!['AAPL'].currency).toBe('USD');
      expect(result!['MSFT'].currency).toBe('USD');
    });

    it('should migrate currency from old collection', async () => {
      const entryExitValues = {
        'AAPL': {
          entry1: 150,
          entry2: 155,
          exit1: 160,
          exit2: 165,
          currency: 'USD',
          dateOfUpdate: '2024-01-01',
        },
      };

      const currencyValues = {
        'MSFT': 'EUR',
      };

      mockGetDoc
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ values: entryExitValues }),
        })
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ values: currencyValues }),
        });

      const result = await loadEntryExitValues(mockUser);

      expect(result!['AAPL'].currency).toBe('USD');
      expect(result!['MSFT']).toBeDefined();
      expect(result!['MSFT'].currency).toBe('EUR');
    });
  });

  describe('saveCurrencyValues', () => {
    const testValues = {
      'AAPL': 'USD',
      'VOLV-B': 'SEK',
    };

    it('should save to Firestore when user is authenticated', async () => {
      mockSetDoc.mockResolvedValue(undefined);

      await saveCurrencyValues(mockUser, testValues);

      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.any(Object),
        {
          values: testValues,
          updatedAt: expect.any(Object),
        },
        { merge: true }
      );
    });

    it('should fallback to localStorage when user is not authenticated', async () => {
      await saveCurrencyValues(null, testValues);

      expect(mockSetDoc).not.toHaveBeenCalled();
      const stored = localStorage.getItem('tachart-currency-map');
      expect(JSON.parse(stored!)).toEqual(testValues);
    });

    it('should fallback to localStorage when Firestore save fails', async () => {
      mockSetDoc.mockRejectedValue(new Error('Firestore error'));

      await saveCurrencyValues(mockUser, testValues);

      const stored = localStorage.getItem('tachart-currency-map');
      expect(JSON.parse(stored!)).toEqual(testValues);
    });
  });

  describe('loadCurrencyValues', () => {
    it('should load from Firestore when user is authenticated', async () => {
      const testValues = {
        'AAPL': 'USD',
        'VOLV-B': 'SEK',
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ values: testValues }),
      });

      const result = await loadCurrencyValues(mockUser);

      expect(result).toEqual(testValues);
    });

    it('should fallback to localStorage when user is not authenticated', async () => {
      const testValues = {
        'AAPL': 'USD',
      };

      localStorage.setItem('tachart-currency-map', JSON.stringify(testValues));

      const result = await loadCurrencyValues(null);

      expect(result).toEqual(testValues);
    });

    it('should return null when no data exists', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
        data: () => null,
      });

      const result = await loadCurrencyValues(mockUser);

      expect(result).toBeNull();
    });
  });

  describe('saveThresholdValues', () => {
    const testValues = {
      'Technology': {
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

    it('should save to Firestore when user is authenticated', async () => {
      mockSetDoc.mockResolvedValue(undefined);

      await saveThresholdValues(mockUser, testValues);

      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.any(Object),
        {
          values: testValues,
          updatedAt: expect.any(Object),
        },
        { merge: true }
      );
    });

    it('should fallback to localStorage when user is not authenticated', async () => {
      await saveThresholdValues(null, testValues);

      expect(mockSetDoc).not.toHaveBeenCalled();
      const stored = localStorage.getItem('thresholdValues');
      expect(JSON.parse(stored!)).toEqual(testValues);
    });

    it('should fallback to localStorage when Firestore save fails', async () => {
      mockSetDoc.mockRejectedValue(new Error('Firestore error'));

      await saveThresholdValues(mockUser, testValues);

      const stored = localStorage.getItem('thresholdValues');
      expect(JSON.parse(stored!)).toEqual(testValues);
    });
  });

  describe('loadThresholdValues', () => {
    it('should load from Firestore when user is authenticated', async () => {
      const testValues = {
        'Technology': {
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

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ values: testValues }),
      });

      const result = await loadThresholdValues(mockUser);

      expect(result).toEqual(testValues);
    });

    it('should fallback to localStorage when user is not authenticated', async () => {
      const testValues = {
        'Technology': {
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

      localStorage.setItem('thresholdValues', JSON.stringify(testValues));

      const result = await loadThresholdValues(null);

      expect(result).toEqual(testValues);
    });

    it('should return null when no data exists', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
        data: () => null,
      });

      const result = await loadThresholdValues(mockUser);

      expect(result).toBeNull();
    });
  });
});
