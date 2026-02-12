/**
 * Filter Types
 * 
 * Type definitions for advanced filtering with groups and AND/OR logic.
 */

import type { ColumnFilters } from '../hooks/useColumnFilters';

export type FilterType = 'text' | 'number' | 'numberRange' | 'select' | 'boolean';

export interface FilterConfig {
  key: string;
  label: string;
  type: FilterType;
  options?: { value: string | number; label: string }[];
  min?: number;
  max?: number;
  step?: number;
}

export interface FilterValues {
  [key: string]: string | number | { min?: number; max?: number } | boolean | null;
}

export type FilterOperator = 'AND' | 'OR';

export interface FilterGroup {
  id: string;
  operator: FilterOperator;
  filters: FilterValues[];
}

export interface FilterGroupState {
  groups: FilterGroup[];
  groupOperator: FilterOperator; // Operator between groups
}

/** State from a shareable link for hydrating table filter/sort/search on load */
export interface ShareableTableState {
  filterState?: FilterValues;
  columnFilters?: ColumnFilters;
  searchValue?: string;
  sortConfig?: { key: string; direction: 'asc' | 'desc' };
}
