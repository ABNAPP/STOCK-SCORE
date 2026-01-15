/**
 * Filter Storage Service
 * 
 * Provides functionality to save and load filter combinations in localStorage.
 * Filters are stored per table (tableId) and can be named for easy retrieval.
 */

import { FilterValues } from '../components/AdvancedFilters';
import { logger } from '../utils/logger';

/**
 * Saved filter interface
 * 
 * Represents a saved filter combination with metadata.
 */
export interface SavedFilter {
  /** Name of the saved filter */
  name: string;
  /** Filter values (column filters, search terms, etc.) */
  values: FilterValues;
  /** Timestamp when filter was created (milliseconds since epoch) */
  createdAt: number;
  /** ID of the table this filter belongs to */
  tableId: string;
}

// localStorage key prefix for filters
const FILTER_STORAGE_PREFIX = 'filters:';

/**
 * Get storage key for a specific filter
 */
function getFilterKey(tableId: string, filterName: string): string {
  return `${FILTER_STORAGE_PREFIX}${tableId}:${filterName}`;
}

/**
 * Get storage key for listing all filters for a table
 */
function getTableFiltersKey(tableId: string): string {
  return `${FILTER_STORAGE_PREFIX}${tableId}:list`;
}

/**
 * Save a filter with a name for a specific table
 * 
 * Saves a filter combination to localStorage with a name for easy retrieval.
 * If a filter with the same name already exists, it will be updated.
 * 
 * @param tableId - ID of the table this filter belongs to
 * @param name - Name to save the filter under
 * @param values - Filter values to save
 * @throws {Error} If tableId or name is missing, or localStorage quota is exceeded
 * 
 * @example
 * ```typescript
 * saveFilter('scoreBoard', 'High Score Stocks', {
 *   searchTerm: '',
 *   columnFilters: { score: { min: 80 } }
 * });
 * ```
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

    localStorage.setItem(filterKey, JSON.stringify(savedFilter));

    // Update the list of saved filters for this table
    const savedFilters = getSavedFilters(tableId);
    const existingIndex = savedFilters.findIndex(f => f.name === name.trim());
    
    if (existingIndex >= 0) {
      // Update existing filter
      savedFilters[existingIndex] = savedFilter;
    } else {
      // Add new filter
      savedFilters.push(savedFilter);
    }

    // Save updated list
    const listKey = getTableFiltersKey(tableId);
    localStorage.setItem(listKey, JSON.stringify(savedFilters.map(f => f.name)));

    logger.debug(`Filter "${name}" saved for table "${tableId}"`, { component: 'filterStorageService', operation: 'saveFilter', tableId, name });
  } catch (error) {
    logger.error(`Error saving filter "${name}" for table "${tableId}"`, error, { component: 'filterStorageService', operation: 'saveFilter', tableId, name });
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      throw new Error('LocalStorage quota exceeded. Please clear some saved filters.');
    }
    throw error;
  }
}

/**
 * Load a saved filter by name for a specific table
 * 
 * Retrieves a saved filter from localStorage by name.
 * 
 * @param tableId - ID of the table the filter belongs to
 * @param name - Name of the filter to load
 * @returns Filter values if found, null otherwise
 * 
 * @example
 * ```typescript
 * const filter = loadFilter('scoreBoard', 'High Score Stocks');
 * if (filter) {
 *   applyFilters(filter);
 * }
 * ```
 */
export function loadFilter(tableId: string, name: string): FilterValues | null {
  try {
    if (!tableId || !name) {
      return null;
    }

    const filterKey = getFilterKey(tableId, name);
    const stored = localStorage.getItem(filterKey);

    if (!stored) {
      return null;
    }

    const savedFilter: SavedFilter = JSON.parse(stored);
    
    // Verify it's for the correct table
    if (savedFilter.tableId !== tableId) {
      logger.warn(`Filter "${name}" belongs to different table. Expected "${tableId}", got "${savedFilter.tableId}"`, { component: 'filterStorageService', operation: 'loadFilter', tableId, name, expectedTableId: savedFilter.tableId });
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
 * 
 * Retrieves all saved filters for a specific table, sorted by creation date
 * (newest first).
 * 
 * @param tableId - ID of the table to get filters for
 * @returns Array of saved filters, sorted by creation date (newest first)
 * 
 * @example
 * ```typescript
 * const filters = getSavedFilters('scoreBoard');
 * filters.forEach(filter => {
 *   console.log(filter.name, filter.createdAt);
 * });
 * ```
 */
export function getSavedFilters(tableId: string): SavedFilter[] {
  try {
    if (!tableId) {
      return [];
    }

    const listKey = getTableFiltersKey(tableId);
    const filterNamesJson = localStorage.getItem(listKey);

    if (!filterNamesJson) {
      return [];
    }

    const filterNames: string[] = JSON.parse(filterNamesJson);
    const savedFilters: SavedFilter[] = [];

    for (const name of filterNames) {
      const filterKey = getFilterKey(tableId, name);
      const stored = localStorage.getItem(filterKey);
      
      if (stored) {
        try {
          const savedFilter: SavedFilter = JSON.parse(stored);
          // Only include filters for this table
          if (savedFilter.tableId === tableId) {
            savedFilters.push(savedFilter);
          }
        } catch (error) {
          logger.error(`Error parsing filter "${name}"`, error, { component: 'filterStorageService', operation: 'getSavedFilters', tableId, name });
          // Remove corrupted filter from list
          deleteFilter(tableId, name);
        }
      }
    }

    // Sort by creation date (newest first)
    return savedFilters.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    logger.error(`Error getting saved filters for table "${tableId}"`, error, { component: 'filterStorageService', operation: 'getSavedFilters', tableId });
    return [];
  }
}

/**
 * Delete a saved filter
 * 
 * Removes a saved filter from localStorage.
 * 
 * @param tableId - ID of the table the filter belongs to
 * @param name - Name of the filter to delete
 * 
 * @example
 * ```typescript
 * deleteFilter('scoreBoard', 'High Score Stocks');
 * ```
 */
export function deleteFilter(tableId: string, name: string): void {
  try {
    if (!tableId || !name) {
      return;
    }

    const filterKey = getFilterKey(tableId, name);
    localStorage.removeItem(filterKey);

    // Update the list of saved filters
    const listKey = getTableFiltersKey(tableId);
    const filterNamesJson = localStorage.getItem(listKey);

    if (filterNamesJson) {
      const filterNames: string[] = JSON.parse(filterNamesJson);
      const updatedNames = filterNames.filter(n => n !== name);
      
      if (updatedNames.length > 0) {
        localStorage.setItem(listKey, JSON.stringify(updatedNames));
      } else {
        localStorage.removeItem(listKey);
      }
    }

    logger.debug(`Filter "${name}" deleted for table "${tableId}"`, { component: 'filterStorageService', operation: 'deleteFilter', tableId, name });
  } catch (error) {
    logger.error(`Error deleting filter "${name}" for table "${tableId}"`, error, { component: 'filterStorageService', operation: 'deleteFilter', tableId, name });
  }
}

/**
 * Clear all saved filters for a specific table
 * 
 * Removes all saved filters for a specific table from localStorage.
 * 
 * @param tableId - ID of the table to clear filters for
 * 
 * @example
 * ```typescript
 * clearAllFilters('scoreBoard');
 * ```
 */
export function clearAllFilters(tableId: string): void {
  try {
    if (!tableId) {
      return;
    }

    const savedFilters = getSavedFilters(tableId);
    for (const filter of savedFilters) {
      const filterKey = getFilterKey(tableId, filter.name);
      localStorage.removeItem(filterKey);
    }

    const listKey = getTableFiltersKey(tableId);
    localStorage.removeItem(listKey);

    logger.debug(`All filters cleared for table "${tableId}"`, { component: 'filterStorageService', operation: 'clearAllFilters', tableId });
  } catch (error) {
    logger.error(`Error clearing filters for table "${tableId}"`, error, { component: 'filterStorageService', operation: 'clearAllFilters', tableId });
  }
}

