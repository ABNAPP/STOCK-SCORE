/**
 * Filter Evaluator
 * 
 * Utility functions to evaluate filter groups with AND/OR logic.
 */

import { FilterValues, FilterGroup, FilterOperator } from '../types/filters';

/**
 * Check if a single filter matches an item
 */
function matchesFilter<T extends Record<string, unknown>>(
  item: T,
  filterKey: string,
  filterValue: string | number | { min?: number; max?: number } | boolean | null
): boolean {
  if (filterValue === null || filterValue === '' || filterValue === undefined) {
    return true; // No filter applied
  }

  const itemValue = item[filterKey];

  // Handle null/undefined values
  if (itemValue === null || itemValue === undefined) {
    return false;
  }

  // Handle number range filter
  if (typeof filterValue === 'object' && filterValue !== null && ('min' in filterValue || 'max' in filterValue)) {
    const numValue = typeof itemValue === 'number' ? itemValue : parseFloat(String(itemValue));
    if (isNaN(numValue)) return false;
    
    const { min, max } = filterValue as { min?: number; max?: number };
    if (min !== undefined && numValue < min) return false;
    if (max !== undefined && numValue > max) return false;
    return true;
  }

  // Handle boolean filter
  if (typeof filterValue === 'boolean') {
    return Boolean(itemValue) === filterValue;
  }

  // Handle number filter
  if (typeof filterValue === 'number') {
    const numValue = typeof itemValue === 'number' ? itemValue : parseFloat(String(itemValue));
    return !isNaN(numValue) && numValue === filterValue;
  }

  // Handle text/string filter
  if (typeof filterValue === 'string') {
    return String(itemValue).toLowerCase().includes(filterValue.toLowerCase());
  }

  return true;
}

/**
 * Evaluate a filter group against an item
 */
function evaluateFilterGroup<T extends Record<string, unknown>>(
  item: T,
  group: FilterGroup
): boolean {
  if (group.filters.length === 0) {
    return true; // Empty group matches everything
  }

  if (group.operator === 'AND') {
    // All filters in group must match
    return group.filters.every((filter) => {
      return Object.entries(filter).every(([key, value]) => {
        return matchesFilter(item, key, value);
      });
    });
  } else {
    // OR: At least one filter in group must match
    return group.filters.some((filter) => {
      return Object.entries(filter).some(([key, value]) => {
        return matchesFilter(item, key, value);
      });
    });
  }
}

/**
 * Evaluate filter groups against an item
 */
export function evaluateFilterGroups<T extends Record<string, unknown>>(
  item: T,
  groups: FilterGroup[],
  groupOperator: FilterOperator = 'AND'
): boolean {
  if (groups.length === 0) {
    return true; // No groups means no filtering
  }

  if (groupOperator === 'AND') {
    // All groups must match
    return groups.every((group) => evaluateFilterGroup(item, group));
  } else {
    // OR: At least one group must match
    return groups.some((group) => evaluateFilterGroup(item, group));
  }
}

/**
 * Convert legacy FilterValues to FilterGroup format
 */
export function convertToFilterGroups(filterValues: FilterValues): FilterGroup[] {
  if (!filterValues || Object.keys(filterValues).length === 0) {
    return [];
  }

  // Convert single filter set to a single group with AND operator
  return [
    {
      id: 'group-1',
      operator: 'AND',
      filters: [filterValues],
    },
  ];
}
