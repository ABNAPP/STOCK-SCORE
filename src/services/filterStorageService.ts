/**
 * Filter Storage Service
 * 
 * Provides functionality to save and load filter combinations in localStorage.
 * Filters are stored per table (tableId) and can be named for easy retrieval.
 */

import { FilterValues } from '../components/AdvancedFilters';

export interface SavedFilter {
  name: string;
  values: FilterValues;
  createdAt: number;
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

    console.log(`Filter "${name}" saved for table "${tableId}"`);
  } catch (error) {
    console.error(`Error saving filter "${name}" for table "${tableId}":`, error);
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      throw new Error('LocalStorage quota exceeded. Please clear some saved filters.');
    }
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
    const stored = localStorage.getItem(filterKey);

    if (!stored) {
      return null;
    }

    const savedFilter: SavedFilter = JSON.parse(stored);
    
    // Verify it's for the correct table
    if (savedFilter.tableId !== tableId) {
      console.warn(`Filter "${name}" belongs to different table. Expected "${tableId}", got "${savedFilter.tableId}"`);
      return null;
    }

    return savedFilter.values;
  } catch (error) {
    console.error(`Error loading filter "${name}" for table "${tableId}":`, error);
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
          console.error(`Error parsing filter "${name}":`, error);
          // Remove corrupted filter from list
          deleteFilter(tableId, name);
        }
      }
    }

    // Sort by creation date (newest first)
    return savedFilters.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error(`Error getting saved filters for table "${tableId}":`, error);
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

    console.log(`Filter "${name}" deleted for table "${tableId}"`);
  } catch (error) {
    console.error(`Error deleting filter "${name}" for table "${tableId}":`, error);
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

    const savedFilters = getSavedFilters(tableId);
    for (const filter of savedFilters) {
      const filterKey = getFilterKey(tableId, filter.name);
      localStorage.removeItem(filterKey);
    }

    const listKey = getTableFiltersKey(tableId);
    localStorage.removeItem(listKey);

    console.log(`All filters cleared for table "${tableId}"`);
  } catch (error) {
    console.error(`Error clearing filters for table "${tableId}":`, error);
  }
}

