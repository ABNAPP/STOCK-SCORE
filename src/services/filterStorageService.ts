/**
 * Filter Storage Service
 * 
 * Provides functionality to save and load filter combinations.
 * Uses in-memory storage (session-only); Firestore is the only persistent data source.
 */

import { FilterValues } from '../components/AdvancedFilters';
import { logger } from '../utils/logger';

/**
 * Saved filter interface
 */
export interface SavedFilter {
  name: string;
  values: FilterValues;
  createdAt: number;
  tableId: string;
}

// In-memory storage (session-only)
const filterStore = new Map<string, SavedFilter>();
const tableFilterLists = new Map<string, string[]>();

function getFilterKey(tableId: string, filterName: string): string {
  return `filters:${tableId}:${filterName}`;
}

/**
 * Save a filter with a name for a specific table
 */
export function saveFilter(tableId: string, name: string, values: FilterValues): void {
  try {
    if (!tableId || !name || !name.trim()) {
      throw new Error('Table ID and filter name are required');
    }

    const filterKey = getFilterKey(tableId, name.trim());
    const savedFilter: SavedFilter = {
      name: name.trim(),
      values,
      createdAt: Date.now(),
      tableId,
    };

    filterStore.set(filterKey, savedFilter);

    const list = tableFilterLists.get(tableId) || [];
    const existingIndex = list.indexOf(name.trim());
    if (existingIndex >= 0) {
      list[existingIndex] = name.trim();
    } else {
      list.push(name.trim());
    }
    tableFilterLists.set(tableId, list);

    logger.debug(`Filter "${name}" saved for table "${tableId}"`, { component: 'filterStorageService', operation: 'saveFilter', tableId, name });
  } catch (error) {
    logger.error(`Error saving filter "${name}" for table "${tableId}"`, error, { component: 'filterStorageService', operation: 'saveFilter', tableId, name });
    throw error;
  }
}

/**
 * Load a saved filter by name for a specific table
 */
export function loadFilter(tableId: string, name: string): FilterValues | null {
  try {
    if (!tableId || !name) {
      return null;
    }

    const filterKey = getFilterKey(tableId, name);
    const savedFilter = filterStore.get(filterKey);

    if (!savedFilter || savedFilter.tableId !== tableId) {
      return null;
    }

    return savedFilter.values;
  } catch (error) {
    logger.error(`Error loading filter "${name}" for table "${tableId}"`, error, { component: 'filterStorageService', operation: 'loadFilter', tableId, name });
    return null;
  }
}

/**
 * Get all saved filters for a specific table
 */
export function getSavedFilters(tableId: string): SavedFilter[] {
  try {
    if (!tableId) {
      return [];
    }

    const filterNames = tableFilterLists.get(tableId) || [];
    const savedFilters: SavedFilter[] = [];

    for (const name of filterNames) {
      const filterKey = getFilterKey(tableId, name);
      const savedFilter = filterStore.get(filterKey);
      if (savedFilter && savedFilter.tableId === tableId) {
        savedFilters.push(savedFilter);
      }
    }

    return savedFilters.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    logger.error(`Error getting saved filters for table "${tableId}"`, error, { component: 'filterStorageService', operation: 'getSavedFilters', tableId });
    return [];
  }
}

/**
 * Delete a saved filter
 */
export function deleteFilter(tableId: string, name: string): void {
  try {
    if (!tableId || !name) {
      return;
    }

    const filterKey = getFilterKey(tableId, name);
    filterStore.delete(filterKey);

    const list = tableFilterLists.get(tableId) || [];
    const updated = list.filter((n) => n !== name);
    if (updated.length > 0) {
      tableFilterLists.set(tableId, updated);
    } else {
      tableFilterLists.delete(tableId);
    }

    logger.debug(`Filter "${name}" deleted for table "${tableId}"`, { component: 'filterStorageService', operation: 'deleteFilter', tableId, name });
  } catch (error) {
    logger.error(`Error deleting filter "${name}" for table "${tableId}"`, error, { component: 'filterStorageService', operation: 'deleteFilter', tableId, name });
  }
}

/**
 * Clear all saved filters for a specific table
 */
export function clearAllFilters(tableId: string): void {
  try {
    if (!tableId) {
      return;
    }

    const filterNames = tableFilterLists.get(tableId) || [];
    for (const name of filterNames) {
      filterStore.delete(getFilterKey(tableId, name));
    }
    tableFilterLists.delete(tableId);

    logger.debug(`All filters cleared for table "${tableId}"`, { component: 'filterStorageService', operation: 'clearAllFilters', tableId });
  } catch (error) {
    logger.error(`Error clearing filters for table "${tableId}"`, error, { component: 'filterStorageService', operation: 'clearAllFilters', tableId });
  }
}
