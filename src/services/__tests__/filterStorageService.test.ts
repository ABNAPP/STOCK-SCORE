import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveFilter,
  loadFilter,
  getSavedFilters,
  deleteFilter,
  clearAllFilters,
  SavedFilter,
} from '../filterStorageService';
import { FilterValues } from '../../components/AdvancedFilters';

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('filterStorageService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('saveFilter', () => {
    it('should save a filter successfully', () => {
      const tableId = 'testTable';
      const filterName = 'High Score Stocks';
      const filterValues: FilterValues = {
        score: { min: 80, max: 100 },
        companyName: 'Test',
      };

      expect(() => saveFilter(tableId, filterName, filterValues)).not.toThrow();

      const saved = loadFilter(tableId, filterName);
      expect(saved).toEqual(filterValues);
    });

    it('should throw error if tableId is missing', () => {
      const filterValues: FilterValues = { score: { min: 80 } };

      expect(() => saveFilter('', 'Test Filter', filterValues)).toThrow('Table ID and filter name are required');
    });

    it('should throw error if filter name is missing', () => {
      const filterValues: FilterValues = { score: { min: 80 } };

      expect(() => saveFilter('testTable', '', filterValues)).toThrow('Table ID and filter name are required');
    });

    it('should throw error if filter name is only whitespace', () => {
      const filterValues: FilterValues = { score: { min: 80 } };

      expect(() => saveFilter('testTable', '   ', filterValues)).toThrow('Table ID and filter name are required');
    });

    it('should trim filter name whitespace', () => {
      const tableId = 'testTable';
      const filterName = '  High Score Stocks  ';
      const filterValues: FilterValues = { score: { min: 80 } };

      saveFilter(tableId, filterName, filterValues);

      const saved = loadFilter(tableId, 'High Score Stocks');
      expect(saved).toEqual(filterValues);
    });

    it('should update existing filter with same name', () => {
      const tableId = 'testTable';
      const filterName = 'High Score Stocks';
      const filterValues1: FilterValues = { score: { min: 80 } };
      const filterValues2: FilterValues = { score: { min: 90 } };

      saveFilter(tableId, filterName, filterValues1);
      saveFilter(tableId, filterName, filterValues2);

      const saved = loadFilter(tableId, filterName);
      expect(saved).toEqual(filterValues2);
    });

    it('should handle localStorage quota exceeded error', () => {
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        const error = new DOMException('QuotaExceededError');
        error.name = 'QuotaExceededError';
        throw error;
      });

      const filterValues: FilterValues = { score: { min: 80 } };

      expect(() => saveFilter('testTable', 'Test Filter', filterValues)).toThrow('LocalStorage quota exceeded');

      localStorage.setItem = originalSetItem;
    });

    it('should handle special characters in filter name', () => {
      const tableId = 'testTable';
      const filterName = 'Filter & Co. <Special>';
      const filterValues: FilterValues = { score: { min: 80 } };

      saveFilter(tableId, filterName, filterValues);

      const saved = loadFilter(tableId, filterName);
      expect(saved).toEqual(filterValues);
    });
  });

  describe('loadFilter', () => {
    it('should load a saved filter', () => {
      const tableId = 'testTable';
      const filterName = 'High Score Stocks';
      const filterValues: FilterValues = {
        score: { min: 80, max: 100 },
        companyName: 'Test',
      };

      saveFilter(tableId, filterName, filterValues);
      const loaded = loadFilter(tableId, filterName);

      expect(loaded).toEqual(filterValues);
    });

    it('should return null if filter does not exist', () => {
      const loaded = loadFilter('testTable', 'NonExistent');
      expect(loaded).toBeNull();
    });

    it('should return null if tableId is missing', () => {
      const loaded = loadFilter('', 'Test Filter');
      expect(loaded).toBeNull();
    });

    it('should return null if filter name is missing', () => {
      const loaded = loadFilter('testTable', '');
      expect(loaded).toBeNull();
    });

    it('should return null if filter belongs to different table', () => {
      const tableId1 = 'table1';
      const tableId2 = 'table2';
      const filterName = 'Test Filter';
      const filterValues: FilterValues = { score: { min: 80 } };

      saveFilter(tableId1, filterName, filterValues);
      const loaded = loadFilter(tableId2, filterName);

      expect(loaded).toBeNull();
    });

    it('should handle corrupted localStorage data gracefully', () => {
      const tableId = 'testTable';
      const filterName = 'Test Filter';
      
      // Manually set corrupted data
      localStorage.setItem(`filters:${tableId}:${filterName}`, 'invalid json');

      const loaded = loadFilter(tableId, filterName);
      expect(loaded).toBeNull();
    });
  });

  describe('getSavedFilters', () => {
    it('should return all saved filters for a table', () => {
      const tableId = 'testTable';
      const filter1: FilterValues = { score: { min: 80 } };
      const filter2: FilterValues = { score: { min: 90 } };

      saveFilter(tableId, 'Filter 1', filter1);
      // Wait a bit to ensure different timestamps
      vi.useFakeTimers();
      vi.advanceTimersByTime(100);
      saveFilter(tableId, 'Filter 2', filter2);
      vi.useRealTimers();

      const filters = getSavedFilters(tableId);

      expect(filters).toHaveLength(2);
      expect(filters.map(f => f.name)).toContain('Filter 1');
      expect(filters.map(f => f.name)).toContain('Filter 2');
    });

    it('should return empty array if no filters exist', () => {
      const filters = getSavedFilters('testTable');
      expect(filters).toEqual([]);
    });

    it('should return empty array if tableId is missing', () => {
      const filters = getSavedFilters('');
      expect(filters).toEqual([]);
    });

    it('should sort filters by creation date (newest first)', () => {
      const tableId = 'testTable';
      
      vi.useFakeTimers();
      saveFilter(tableId, 'Filter 1', { score: { min: 80 } });
      vi.advanceTimersByTime(100);
      saveFilter(tableId, 'Filter 2', { score: { min: 90 } });
      vi.advanceTimersByTime(100);
      saveFilter(tableId, 'Filter 3', { score: { min: 100 } });
      vi.useRealTimers();

      const filters = getSavedFilters(tableId);

      expect(filters).toHaveLength(3);
      expect(filters[0].name).toBe('Filter 3');
      expect(filters[1].name).toBe('Filter 2');
      expect(filters[2].name).toBe('Filter 1');
    });

    it('should only return filters for specified table', () => {
      const tableId1 = 'table1';
      const tableId2 = 'table2';

      saveFilter(tableId1, 'Filter 1', { score: { min: 80 } });
      saveFilter(tableId2, 'Filter 2', { score: { min: 90 } });

      const filters1 = getSavedFilters(tableId1);
      const filters2 = getSavedFilters(tableId2);

      expect(filters1).toHaveLength(1);
      expect(filters1[0].name).toBe('Filter 1');
      expect(filters2).toHaveLength(1);
      expect(filters2[0].name).toBe('Filter 2');
    });

    it('should handle corrupted filter entries gracefully', () => {
      const tableId = 'testTable';
      
      // Save a valid filter
      saveFilter(tableId, 'Valid Filter', { score: { min: 80 } });
      
      // Manually add corrupted entry to the list
      const listKey = `filters:${tableId}:list`;
      localStorage.setItem(listKey, JSON.stringify(['Valid Filter', 'Corrupted Filter']));
      localStorage.setItem(`filters:${tableId}:Corrupted Filter`, 'invalid json');

      const filters = getSavedFilters(tableId);

      // Should only return valid filter and remove corrupted one
      expect(filters).toHaveLength(1);
      expect(filters[0].name).toBe('Valid Filter');
    });
  });

  describe('deleteFilter', () => {
    it('should delete a saved filter', () => {
      const tableId = 'testTable';
      const filterName = 'Test Filter';
      const filterValues: FilterValues = { score: { min: 80 } };

      saveFilter(tableId, filterName, filterValues);
      expect(loadFilter(tableId, filterName)).toEqual(filterValues);

      deleteFilter(tableId, filterName);

      expect(loadFilter(tableId, filterName)).toBeNull();
    });

    it('should not throw if filter does not exist', () => {
      expect(() => deleteFilter('testTable', 'NonExistent')).not.toThrow();
    });

    it('should not throw if tableId is missing', () => {
      expect(() => deleteFilter('', 'Test Filter')).not.toThrow();
    });

    it('should not throw if filter name is missing', () => {
      expect(() => deleteFilter('testTable', '')).not.toThrow();
    });

    it('should remove filter from list when deleted', () => {
      const tableId = 'testTable';

      saveFilter(tableId, 'Filter 1', { score: { min: 80 } });
      saveFilter(tableId, 'Filter 2', { score: { min: 90 } });

      expect(getSavedFilters(tableId)).toHaveLength(2);

      deleteFilter(tableId, 'Filter 1');

      const filters = getSavedFilters(tableId);
      expect(filters).toHaveLength(1);
      expect(filters[0].name).toBe('Filter 2');
    });

    it('should remove list key when last filter is deleted', () => {
      const tableId = 'testTable';
      const filterName = 'Test Filter';

      saveFilter(tableId, filterName, { score: { min: 80 } });
      expect(localStorage.getItem(`filters:${tableId}:list`)).toBeTruthy();

      deleteFilter(tableId, filterName);
      expect(localStorage.getItem(`filters:${tableId}:list`)).toBeNull();
    });
  });

  describe('clearAllFilters', () => {
    it('should clear all filters for a table', () => {
      const tableId = 'testTable';

      saveFilter(tableId, 'Filter 1', { score: { min: 80 } });
      saveFilter(tableId, 'Filter 2', { score: { min: 90 } });

      expect(getSavedFilters(tableId)).toHaveLength(2);

      clearAllFilters(tableId);

      expect(getSavedFilters(tableId)).toHaveLength(0);
      expect(loadFilter(tableId, 'Filter 1')).toBeNull();
      expect(loadFilter(tableId, 'Filter 2')).toBeNull();
    });

    it('should not affect filters from other tables', () => {
      const tableId1 = 'table1';
      const tableId2 = 'table2';

      saveFilter(tableId1, 'Filter 1', { score: { min: 80 } });
      saveFilter(tableId2, 'Filter 2', { score: { min: 90 } });

      clearAllFilters(tableId1);

      expect(getSavedFilters(tableId1)).toHaveLength(0);
      expect(getSavedFilters(tableId2)).toHaveLength(1);
    });

    it('should not throw if tableId is missing', () => {
      expect(() => clearAllFilters('')).not.toThrow();
    });

    it('should not throw if no filters exist', () => {
      expect(() => clearAllFilters('testTable')).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle multiple filters per table', () => {
      const tableId = 'testTable';
      const filters = [
        { name: 'Filter 1', values: { score: { min: 80 } } },
        { name: 'Filter 2', values: { score: { min: 90 } } },
        { name: 'Filter 3', values: { companyName: 'Test' } },
      ];

      filters.forEach(({ name, values }) => {
        saveFilter(tableId, name, values);
      });

      const saved = getSavedFilters(tableId);
      expect(saved).toHaveLength(3);
    });

    it('should handle complex filter values', () => {
      const tableId = 'testTable';
      const filterName = 'Complex Filter';
      const filterValues: FilterValues = {
        score: { min: 80, max: 100 },
        companyName: 'Test Company',
        industry: 'Technology',
        irr: { min: 20 },
        mungerQualityScore: { max: 75 },
      };

      saveFilter(tableId, filterName, filterValues);
      const loaded = loadFilter(tableId, filterName);

      expect(loaded).toEqual(filterValues);
    });
  });
});
