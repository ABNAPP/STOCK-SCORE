/**
 * Data Transformers
 * 
 * Helper functions for transforming and parsing data from Google Sheets.
 * Includes value extraction, validation, parsing, and industry mapping functions.
 */

import type { DataRow } from './types';
import { isDataRow, isString, isNumber } from '../../utils/typeGuards';

/**
 * Helper function to get value from row with case-insensitive matching
 * 
 * Searches for a value in a data row by trying multiple possible column names.
 * Performs both exact and case-insensitive matching.
 * 
 * @param possibleNames - Array of possible column names to search for
 * @param row - Data row object to search in
 * @returns The found value as a trimmed string, or empty string if not found
 */
export function getValue(possibleNames: string[], row: DataRow): string {
  if (!isDataRow(row)) {
    return '';
  }
  
  for (const name of possibleNames) {
    if (!isString(name)) continue;
    
    // Try exact match first
    const value = row[name];
    if (value !== undefined && value !== null && value !== '') {
      return String(value).trim();
    }
    // Try case-insensitive match
    const lowerName = name.toLowerCase();
    for (const key in row) {
      if (key.toLowerCase() === lowerName) {
        const val = row[key];
        if (val !== undefined && val !== null && val !== '') {
          return String(val).trim();
        }
      }
    }
  }
  return '';
}

/**
 * Helper function to validate values (filter out #N/A, etc.)
 * 
 * Checks if a value is valid by filtering out common Excel error values,
 * "Loading..." text, and empty strings.
 * 
 * @param value - The value to validate
 * @returns True if the value is valid, false otherwise
 */
export function isValidValue(value: string): boolean {
  if (!value) return false;
  const normalized = value.trim().toUpperCase();
  return normalized !== '#N/A' && normalized !== 'N/A' && normalized !== '#NUM!' && normalized !== '#VALUE!' && normalized !== '#DIV/0!' && normalized !== '#REF!' && normalized !== 'LOADING...';
}

/**
 * Helper function to parse numeric values that can distinguish between invalid (null) and actual zero (0)
 * 
 * Parses a string value to a number, handling Excel error values and invalid formats.
 * Returns null for invalid values, allowing distinction between missing data and zero.
 * 
 * @param valueStr - String value to parse (may contain commas, spaces, currency symbols)
 * @returns Parsed number, or null if value is invalid or an error value
 */
export function parseNumericValueNullable(valueStr: string): number | null {
  if (!isString(valueStr) || !isValidValue(valueStr)) return null;
  
  // Remove common prefixes and clean the string
  let cleaned = String(valueStr)
    .replace(/,/g, '.')
    .replace(/\s/g, '')
    .replace(/#/g, '')
    .replace(/%/g, '')
    .replace(/\$/g, '');
  
  const parsed = parseFloat(cleaned);
  if (!isNumber(parsed) || isNaN(parsed) || !isFinite(parsed)) return null;
  
  return parsed;
}

/**
 * Helper function to get value from row with case-insensitive matching (allows 0 values)
 * 
 * Similar to getValue(), but allows zero (0) as a valid value instead of treating it
 * as missing data. Useful for numeric fields where zero is meaningful.
 * 
 * @param possibleNames - Array of possible column names to search for
 * @param row - Data row object to search in
 * @returns The found value as a trimmed string, or empty string if not found
 */
export function getValueAllowZero(possibleNames: string[], row: DataRow): string {
  for (const name of possibleNames) {
    // Try exact match first
    if (row[name] !== undefined && row[name] !== null) {
      const value = row[name];
      // Om värdet är 0 (nummer eller sträng "0"), returnera "0"
      if (value === 0 || value === '0') {
        return '0';
      }
      // Om värdet är en tom sträng, hoppa över
      if (value === '') {
        continue;
      }
      return String(value).trim();
    }
    // Try case-insensitive match
    const lowerName = name.toLowerCase();
    for (const key in row) {
      if (key.toLowerCase() === lowerName) {
        const value = row[key];
        // Tillåt 0 som ett giltigt värde
        if (value !== undefined && value !== null) {
          // Om värdet är 0 (nummer eller sträng "0"), returnera "0"
          if (value === 0 || value === '0') {
            return '0';
          }
          // Om värdet är en tom sträng, hoppa över
          if (value === '') {
            continue;
          }
          return String(value).trim();
        }
      }
    }
  }
  return '';
}

/**
 * Helper function to parse percentage values that can distinguish between invalid (null) and actual zero (0)
 * 
 * Parses a percentage string value to a number, handling Excel error values and percentage symbols.
 * Returns null for invalid values, allowing distinction between missing data and zero percent.
 * 
 * @param valueStr - String value to parse (may contain %, commas, spaces)
 * @returns Parsed number (percentage as decimal, e.g., 15% becomes 15), or null if invalid
 */
export function parsePercentageValueNullable(valueStr: string): number | null {
  if (!isString(valueStr) || !isValidValue(valueStr)) return null;
  
  // Remove % sign and clean the string
  let cleaned = String(valueStr)
    .replace(/,/g, '.')
    .replace(/\s/g, '')
    .replace(/#/g, '')
    .replace(/%/g, '')
    .replace(/\$/g, '');
  
  const parsed = parseFloat(cleaned);
  if (!isNumber(parsed) || isNaN(parsed) || !isFinite(parsed)) return null;
  
  return parsed;
}

/**
 * Helper function to calculate median
 * 
 * Calculates the median value from an array of numbers.
 * Returns null for empty arrays.
 * 
 * @param values - Array of numbers to calculate median from
 * @returns Median value, or null if array is empty
 */
export function calculateMedian(values: number[]): number | null {
  if (!Array.isArray(values) || values.length === 0) return null;
  
  // Filter out invalid numbers
  const validNumbers = values.filter(v => isNumber(v) && !isNaN(v) && isFinite(v));
  if (validNumbers.length === 0) return null;
  
  const sorted = [...validNumbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    return sorted[mid];
  }
}

/**
 * Helper function to find IRR threshold for an industry
 * 
 * Looks up the IRR (Internal Rate of Return) threshold value for a given industry
 * from the industry thresholds configuration. Performs case-insensitive matching.
 * 
 * @param industryName - Name of the industry to look up
 * @returns IRR threshold value, or 0 if industry not found
 */
