/**
 * Types for sheets service
 * 
 * Shared types used across sheets service modules.
 */

/**
 * Type for row data (compatible with both CSV and JSON)
 * Values can be string, number, or undefined
 */
export type DataRow = Record<string, string | number | undefined>;

/**
 * Progress callback type for tracking fetch progress
 * 
 * @param progress - Progress information including stage, percentage, and optional details
 */
export type ProgressCallback = (progress: {
  stage: 'fetch' | 'parse' | 'transform' | 'complete';
  percentage: number;
  message?: string;
  rowsProcessed?: number;
  totalRows?: number;
}) => void;
