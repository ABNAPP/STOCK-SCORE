/**
 * Data conversion helpers for fetch service (2D array to objects, mock parse result).
 */

import { is2DArray } from '../../utils/typeGuards';
import type { DataRow } from './types';

/**
 * Convert 2D array from Apps Script to object array format
 */
export function convert2DArrayToObjects(data: unknown[][]): DataRow[] {
  if (!is2DArray(data) || data.length === 0) {
    return [];
  }

  const headers = data[0].map((h: unknown) => String(h).trim());
  const rows: DataRow[] = [];

  for (let i = 1; i < data.length; i++) {
    const row: DataRow = {};
    const values = data[i];

    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      const value = values[j];
      if (value === null || value === undefined || value === '') {
        row[header] = '';
      } else if (typeof value === 'string' || typeof value === 'number') {
        row[header] = value;
      } else {
        row[header] = String(value);
      }
    }
    rows.push(row);
  }

  return rows;
}

/**
 * Create a mock Papa.ParseResult-like object for compatibility with existing transformers
 */
export function createMockParseResult(data: DataRow[]): {
  data: DataRow[];
  meta: { fields: string[] | null };
} {
  const fields = data.length > 0 ? Object.keys(data[0]) : null;
  return {
    data,
    meta: { fields },
  };
}
